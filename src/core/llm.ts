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
