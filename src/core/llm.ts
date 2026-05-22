/**
 * LLM client — AI SDK v7 integration
 *
 * Multi-provider support:
 * - OpenAI (@ai-sdk/openai)
 * - OpenRouter / LM Studio / vLLM / Ollama / LlamaCPP (@ai-sdk/openai-compatible)
 *
 * Structured output strategy:
 * - Primary: generateText with output: object (Zod schemas)
 * - Fallback: generateText + manual JSON parse + Zod validation
 *
 * Local model handling:
 * - NoObjectGeneratedError caught and falls back to text mode
 * - Manual JSON extraction strips markdown code fences
 *
 * Timeout:
 * - All generateText calls are wrapped with a 60s AbortController timeout
 */

import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import type { AIConfig, ProviderSpecificConfig } from '../types/config';
import type { Commit } from '../types/commit';
import type { ScoringResult } from '../types/scoring';
import { buildAnalysisPrompt, buildWritePrompt } from './prompts';

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Wrap generateText with an AbortController timeout.
 */
async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

const AnalysisSchema = z.object({
  score: z.number().min(1).max(10),
  issues: z.array(
    z.object({
      category: z.enum(['type', 'scope', 'subject', 'body', 'convention', 'specificity', 'intent', 'clarity']),
      severity: z.enum(['critical', 'warning', 'suggestion']),
      message: z.string(),
    })
  ),
  suggestions: z.array(z.string()),
  suggestion: z.string().optional(),
  whyGood: z.string().optional(),
});

export type LLMAnalysisResult = z.infer<typeof AnalysisSchema>;

export function getProvider(aiConfig: AIConfig, providerConfig: ProviderSpecificConfig) {
  switch (aiConfig.provider) {
    case 'openai': {
      return openai;
    }
    case 'openrouter': {
      return createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: providerConfig.openrouterApiKey ?? 'not-required',
        headers: {
          'HTTP-Referer': 'https://github.com/commit-critic',
          'X-Title': 'commit-critic',
        },
      });
    }
    case 'lmstudio': {
      return createOpenAICompatible({
        name: 'lmstudio',
        baseURL: providerConfig.lmstudioBaseUrl ?? 'http://localhost:1234/v1',
        apiKey: 'not-required',
        supportsStructuredOutputs: false,
      });
    }
    case 'vllm': {
      return createOpenAICompatible({
        name: 'vllm',
        baseURL: providerConfig.vllmBaseUrl ?? 'http://localhost:8000/v1',
        apiKey: providerConfig.vllmApiKey ?? 'not-required',
        supportsStructuredOutputs: false,
      });
    }
    case 'ollama': {
      return createOpenAICompatible({
        name: 'ollama',
        baseURL: providerConfig.ollamaBaseUrl ?? 'http://localhost:11434/v1',
        apiKey: 'not-required',
        supportsStructuredOutputs: false,
      });
    }
    case 'llamacpp': {
      return createOpenAICompatible({
        name: 'llamacpp',
        baseURL: providerConfig.llamacppBaseUrl ?? 'http://localhost:8081/v1',
        apiKey: 'not-required',
        supportsStructuredOutputs: false,
      });
    }
    default: {
      return createOpenAICompatible({
        name: aiConfig.provider,
        baseURL: providerConfig.lmstudioBaseUrl ?? 'http://localhost:1234/v1',
        apiKey: 'not-required',
      });
    }
  }
}

/**
 * Analyze a commit message using LLM.
 */
export async function analyzeCommitWithLLM(
  commit: Commit,
  deterministic: ScoringResult,
  aiConfig: AIConfig,
  providerConfig: ProviderSpecificConfig
): Promise<LLMAnalysisResult> {
  const model: ReturnType<typeof getProvider> extends (model: string) => infer R ? R : never = aiConfig.__testModel ?? getProvider(aiConfig, providerConfig)(aiConfig.model);
  const prompt = buildAnalysisPrompt(commit, deterministic);

  // Local providers (lmstudio, vllm, ollama, llamacpp) don't support structured outputs.
  // Skip directly to text mode to avoid wasted tokens on structured output attempt.
  const isLocalProvider = ['lmstudio', 'vllm', 'ollama', 'llamacpp'].includes(aiConfig.provider);

  if (!isLocalProvider) {
    try {
      const result = await withTimeout((signal) =>
        generateText({
          model,
          output: Output.object({ schema: AnalysisSchema }),
          prompt,
          temperature: aiConfig.temperature,
          maxOutputTokens: aiConfig.maxTokens,
          abortSignal: signal,
        })
      );
      return result.output;
    } catch (err) {
      if (!(err instanceof NoObjectGeneratedError)) throw err;
      // Fall through to text mode
    }
  }

  // Text mode: higher token budget for reasoning models
  const textResult = await withTimeout((signal) =>
    generateText({
      model,
      prompt: prompt + '\n\nRespond with valid JSON only. No markdown code fences, no explanation text.',
      temperature: aiConfig.temperature,
      maxOutputTokens: Math.max(aiConfig.maxTokens, 4096),
      abortSignal: signal,
    })
  );
  const parsed = extractJson(textResult.text);
  if (parsed) {
    const validated = AnalysisSchema.safeParse(parsed);
    if (validated.success) return validated.data;
  }
  throw new Error('Failed to parse LLM response as JSON');
}

/**
 * Generate a commit message suggestion.
 */
export async function generateCommitMessage(
  diff: string,
  type: string,
  scope: string | undefined,
  description: string | undefined,
  aiConfig: AIConfig,
  providerConfig: ProviderSpecificConfig
): Promise<string> {
  const model: ReturnType<typeof getProvider> extends (model: string) => infer R ? R : never = aiConfig.__testModel ?? getProvider(aiConfig, providerConfig)(aiConfig.model);
  const prompt = buildWritePrompt(diff, type, scope, description);

  const result = await withTimeout((signal) =>
    generateText({
      model,
      prompt,
      temperature: aiConfig.temperature,
      maxOutputTokens: aiConfig.maxTokens,
      abortSignal: signal,
    })
  );

  return result.text.trim();
}

/**
 * Generate semantic change bullets from staged diff.
 * Uses LLM when available, falls back to deterministic bullets from file paths.
 */
export async function generateChangeBullets(
  diff: string,
  files: { status: string; path: string }[],
  aiConfig?: AIConfig,
  providerConfig?: ProviderSpecificConfig
): Promise<string[]> {
  // Deterministic fallback: infer from file paths
  const bullets: string[] = [];
  const added = files.filter(f => f.status === 'A').map(f => f.path);
  const modified = files.filter(f => f.status === 'M').map(f => f.path);
  const deleted = files.filter(f => f.status === 'D').map(f => f.path);

  if (added.length > 0) {
    bullets.push(`Added ${added.length} file${added.length > 1 ? 's' : ''}`);
  }
  if (modified.length > 0) {
    bullets.push(`Modified ${modified.length} file${modified.length > 1 ? 's' : ''}`);
  }
  if (deleted.length > 0) {
    bullets.push(`Deleted ${deleted.length} file${deleted.length > 1 ? 's' : ''}`);
  }

  // Try LLM for richer bullets
  if (aiConfig && providerConfig) {
    try {
      const model: ReturnType<typeof getProvider> extends (model: string) => infer R ? R : never = aiConfig.__testModel ?? getProvider(aiConfig, providerConfig)(aiConfig.model);
      const result = await withTimeout((signal) =>
        generateText({
          model,
          prompt: `Given the following git diff, generate 3-5 concise semantic bullets summarizing the changes. Each bullet should be one short sentence.\n\n${diff.slice(0, 8000)}`,
          temperature: 0.3,
          maxOutputTokens: 300,
          abortSignal: signal,
        })
      );
      const lines = result.text
        .split('\n')
        .map(l => l.trim().replace(/^[-•*]\s*/, ''))
        .filter(l => l.length > 0 && l.length < 120);
      if (lines.length >= 2) {
        return lines.slice(0, 5);
      }
    } catch {
      // fall through to deterministic bullets
    }
  }

  return bullets.length > 0 ? bullets : ['Updated files'];
}

export function extractJson(text: string): unknown | null {
  const codeFence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeFence) {
    try {
      return JSON.parse(codeFence[1]);
    } catch {
      // ignore
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    // ignore
  }
  return null;
}
