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

function buildAnalysisPrompt(commit: Commit, deterministic: ScoringResult): string {
  return `You are a senior engineer reviewing commit message quality.

Evaluate the commit message below on a scale of 1-10.

Scoring criteria:
- 1-2: Terrible — one word, no information, or completely misleading
- 3-4: Poor — vague ("fix bug", "update"), missing type/scope
- 5-6: Average — readable but lacks specificity or conventional format
- 7-8: Good — clear, specific, follows conventions
- 9-10: Excellent — precise, includes scope, body explains why, measurable impact

Few-shot examples:
- 1: "wip" — one word, no information
- 2: "fixed bug" — vague, no scope or impact
- 4: "Added new feature" — no type, no scope, no specifics
- 6: "fix: handle auth errors" — CC format but no specifics
- 8: "feat(api): add Redis caching for read endpoints" — Good CC, clear scope
- 10: "feat(api): add Redis caching layer\n\n- Implement cache for read endpoints\n- Add TTL configuration\n- Improves response time by 200ms" — Perfect CC, body with specifics, measurable impact

--- CONTEXT ---
Commit subject: "${commit.subject}"
Commit body: ${commit.body || '(none)'}
Author: ${commit.author}
Date: ${commit.date}

--- DETERMINISTIC CHECKS ---
Score: ${deterministic.score}/10
Issues:
${deterministic.issues.map(i => `- [${i.severity}] ${i.message}`).join('\n') || 'None'}

Provide your score, issues, and suggestions as JSON.`;
}

function buildWritePrompt(diff: string, type: string, scope?: string, description?: string): string {
  return `Write a concise, conventional commit message for the following staged changes.

Commit type: ${type}
${scope ? `Scope: ${scope}` : ''}
${description ? `Description: ${description}` : ''}

Staged diff:
${diff.slice(0, 12000)}

Rules:
- Subject line <= 50 characters
- Use imperative mood ("add", not "added")
- No trailing period
- If the change is complex, add a body after a blank line
- Return ONLY the commit message, no markdown, no quotes.`;
}

function getProvider(aiConfig: AIConfig, providerConfig: ProviderSpecificConfig) {
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
      });
    }
    case 'vllm': {
      return createOpenAICompatible({
        name: 'vllm',
        baseURL: providerConfig.vllmBaseUrl ?? 'http://localhost:8000/v1',
        apiKey: providerConfig.vllmApiKey ?? 'not-required',
      });
    }
    case 'ollama': {
      return createOpenAICompatible({
        name: 'ollama',
        baseURL: providerConfig.ollamaBaseUrl ?? 'http://localhost:11434/v1',
        apiKey: 'not-required',
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
  const provider = getProvider(aiConfig, providerConfig);
  const prompt = buildAnalysisPrompt(commit, deterministic);

  try {
    const result = await generateText({
      model: provider(aiConfig.model),
      output: Output.object({ schema: AnalysisSchema }),
      prompt,
      temperature: aiConfig.temperature,
      maxOutputTokens: aiConfig.maxTokens,
    });
    return result.output;
  } catch (err) {
    if (err instanceof NoObjectGeneratedError) {
      const result = await generateText({
        model: provider(aiConfig.model),
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
  const provider = getProvider(aiConfig, providerConfig);
  const prompt = buildWritePrompt(diff, type, scope, description);

  const result = await generateText({
    model: provider(aiConfig.model),
    prompt,
    temperature: aiConfig.temperature,
    maxOutputTokens: aiConfig.maxTokens,
  });

  return result.text.trim();
}

function extractJson(text: string): unknown | null {
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
