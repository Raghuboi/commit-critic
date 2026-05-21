/**
 * LLM client — AI SDK v7 integration
 *
 * Multi-provider support:
 * - OpenAI (@ai-sdk/openai)
 * - OpenRouter / LM Studio / vLLM / Ollama (@ai-sdk/openai-compatible)
 *
 * Structured output strategy:
 * - Primary: generateText with output: object (Zod schemas)
 * - Fallback: generateText + manual JSON parse + Zod validation
 *
 * Local model handling:
 * - NoObjectGeneratedError caught and falls back to text mode
 * - Manual JSON extraction strips markdown code fences
 */

import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import type { AIConfig, ProviderSpecificConfig } from '../types/config';
import type { Commit } from '../types/commit';
import type { ScoringResult } from '../types/scoring';
import { buildAnalysisPrompt, buildWritePrompt } from './prompts';

const AnalysisSchema = z.object({
  score: z.number().min(1).max(10),
  issues: z.array(
    z.object({
      category: z.string(),
      severity: z.enum(['critical', 'warning', 'suggestion']),
      message: z.string(),
    })
  ),
  suggestions: z.array(z.string()),
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
  const model = aiConfig.__testModel ?? getProvider(aiConfig, providerConfig)(aiConfig.model);
  const prompt = buildAnalysisPrompt(commit, deterministic);

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: AnalysisSchema }),
      prompt,
      temperature: aiConfig.temperature,
      maxOutputTokens: aiConfig.maxTokens,
    });
    return result.output;
  } catch (err) {
    if (err instanceof NoObjectGeneratedError) {
      const result = await generateText({
        model,
        prompt: prompt + '\n\nRespond with valid JSON only.',
        temperature: aiConfig.temperature,
        maxOutputTokens: aiConfig.maxTokens,
      });
      const parsed = extractJson(result.text);
      if (parsed) {
        const validated = AnalysisSchema.safeParse(parsed);
        if (validated.success) return validated.data;
      }
    }
    throw err;
  }
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
  const model = aiConfig.__testModel ?? getProvider(aiConfig, providerConfig)(aiConfig.model);
  const prompt = buildWritePrompt(diff, type, scope, description);

  const result = await generateText({
    model,
    prompt,
    temperature: aiConfig.temperature,
    maxOutputTokens: aiConfig.maxTokens,
  });

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
      const model = aiConfig.__testModel ?? getProvider(aiConfig, providerConfig)(aiConfig.model);
      const result = await generateText({
        model,
        prompt: `Given the following git diff, generate 3-5 concise semantic bullets summarizing the changes. Each bullet should be one short sentence.\n\n${diff.slice(0, 8000)}`,
        temperature: 0.3,
        maxOutputTokens: 300,
      });
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
