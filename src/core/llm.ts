/**
 * LLM client — AI SDK integration.
 *
 * Providers:
 * - OpenAI through @ai-sdk/openai
 * - OpenRouter through OpenAI-compatible chat API
 * - Local OpenAI-compatible servers through provider-specific presets
 */

import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import type { LanguageModelV4 } from '@ai-sdk/provider';
import { z } from 'zod';
import type { AIConfig, ProviderSpecificConfig } from '../types/config';
import type { Commit } from '../types/commit';
import type { ScoringResult } from '../types/scoring';
import { getProviderApiKey, getProviderBaseUrl, getProviderDefinition } from '../config/providers';
import { buildAnalysisPrompt, buildWritePrompt, buildBulletsPrompt, MAX_BULLET_DIFF_CHARS } from './prompts';

type GlobalWithAiSdkWarnings = typeof globalThis & { AI_SDK_LOG_WARNINGS?: boolean };
(globalThis as GlobalWithAiSdkWarnings).AI_SDK_LOG_WARNINGS = false;

function requestOptions(aiConfig: AIConfig) {
  return {
    maxRetries: aiConfig.maxRetries,
    timeout: { totalMs: aiConfig.timeoutMs },
  };
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

type IssueCategory = LLMAnalysisResult['issues'][number]['category'];
type IssueSeverity = LLMAnalysisResult['issues'][number]['severity'];

const ISSUE_CATEGORIES: readonly IssueCategory[] = ['type', 'scope', 'subject', 'body', 'convention', 'specificity', 'intent', 'clarity'];
const ISSUE_SEVERITIES: readonly IssueSeverity[] = ['critical', 'warning', 'suggestion'];

const NullableString = z.union([z.string(), z.null()]).optional();

const LooseAnalysisSchema = z.object({
  score: z.coerce.number(),
  issues: z.array(z.union([
    z.string(),
    z.object({
      category: z.string().optional(),
      severity: z.string().optional(),
      message: z.string().optional(),
    }).passthrough(),
  ])).default([]),
  suggestions: z.array(z.string()).default([]),
  suggestion: NullableString,
  whyGood: NullableString,
}).passthrough();

function createOpenAIProvider(aiConfig: AIConfig, providerConfig: ProviderSpecificConfig) {
  const definition = getProviderDefinition(aiConfig.provider);
  return createOpenAI({
    apiKey: getProviderApiKey(definition.name, providerConfig),
    baseURL: getProviderBaseUrl(definition.name, providerConfig),
    headers: definition.headers,
  });
}

function usesCustomOpenAIBaseUrl(aiConfig: AIConfig, providerConfig: ProviderSpecificConfig): boolean {
  const definition = getProviderDefinition(aiConfig.provider);
  return definition.transport === 'openai' && getProviderBaseUrl(definition.name, providerConfig) !== definition.defaultBaseUrl;
}

function createCompatibleProvider(
  aiConfig: AIConfig,
  providerConfig: ProviderSpecificConfig,
  supportsStructuredOutputs?: boolean
): OpenAICompatibleProvider {
  const definition = getProviderDefinition(aiConfig.provider);
  return createOpenAICompatible({
    name: definition.name,
    baseURL: getProviderBaseUrl(definition.name, providerConfig),
    apiKey: getProviderApiKey(definition.name, providerConfig) ?? 'not-required',
    supportsStructuredOutputs: supportsStructuredOutputs ?? definition.supportsStructuredOutputs,
    headers: definition.headers,
  });
}

export function getProvider(aiConfig: AIConfig, providerConfig: ProviderSpecificConfig) {
  const definition = getProviderDefinition(aiConfig.provider);
  return definition.transport === 'openai' && !usesCustomOpenAIBaseUrl(aiConfig, providerConfig)
    ? createOpenAIProvider(aiConfig, providerConfig)
    : createCompatibleProvider(aiConfig, providerConfig, getSupportsStructuredOutputs(aiConfig, providerConfig));
}

function getSupportsStructuredOutputs(aiConfig: AIConfig, providerConfig: ProviderSpecificConfig): boolean {
  if (usesCustomOpenAIBaseUrl(aiConfig, providerConfig)) return false;
  return getProviderDefinition(aiConfig.provider).supportsStructuredOutputs;
}

function getModel(aiConfig: AIConfig, providerConfig: ProviderSpecificConfig): LanguageModelV4 {
  if (aiConfig.__testModel) return aiConfig.__testModel;

  const definition = getProviderDefinition(aiConfig.provider);

  if (definition.transport === 'openai' && !usesCustomOpenAIBaseUrl(aiConfig, providerConfig)) {
    return createOpenAIProvider(aiConfig, providerConfig)(aiConfig.model);
  }

  const provider = createCompatibleProvider(aiConfig, providerConfig, getSupportsStructuredOutputs(aiConfig, providerConfig));
  if (definition.transport === 'compatible-completion') {
    // llama.cpp/Qwen reasoning models often expose final text through
    // /v1/completions while /v1/chat/completions may emit only reasoning parts.
    return provider.completionModel(aiConfig.model);
  }

  return provider.chatModel(aiConfig.model);
}

/** Analyze a commit message using an LLM. */
export async function analyzeCommitWithLLM(
  commit: Commit,
  deterministic: ScoringResult,
  aiConfig: AIConfig,
  providerConfig: ProviderSpecificConfig
): Promise<LLMAnalysisResult> {
  const model = getModel(aiConfig, providerConfig);
  const prompt = buildAnalysisPrompt(commit, deterministic);
  const supportsStructuredOutputs = getSupportsStructuredOutputs(aiConfig, providerConfig);

  if (supportsStructuredOutputs) {
    try {
      const result = await generateText({
          model,
          output: Output.object({ schema: AnalysisSchema }),
          prompt,
          temperature: aiConfig.temperature,
          maxOutputTokens: aiConfig.maxTokens,
          ...requestOptions(aiConfig),
        });
      return result.output;
    } catch (err) {
      if (!NoObjectGeneratedError.isInstance(err)) throw err;
      // Fall through to text mode for models that reject schema output.
    }
  }

  const textResult = await generateText({
      model,
      prompt: prompt + '\n\nRespond with one valid JSON object only. Do not include markdown fences, explanations, or prose outside the JSON object.',
      temperature: aiConfig.temperature,
      maxOutputTokens: aiConfig.maxTokens,
      ...requestOptions(aiConfig),
    });

  const normalized = normalizeAnalysisResult(extractJson(textResult.text));
  if (normalized) return normalized;
  throw new Error('Failed to parse LLM response as JSON');
}

const CommitMessageSchema = z.object({
  type: z.string(),
  scope: z.string().optional(),
  description: z.string(),
  body: z.string().optional(),
});

/** Generate a commit message suggestion. */
export async function generateCommitMessage(
  diff: string,
  type: string,
  scope: string | undefined,
  description: string | undefined,
  aiConfig: AIConfig,
  providerConfig: ProviderSpecificConfig
): Promise<string> {
  const model = getModel(aiConfig, providerConfig);
  const prompt = buildWritePrompt(diff, type, scope, description);
  const supportsStructuredOutputs = getSupportsStructuredOutputs(aiConfig, providerConfig);

  if (supportsStructuredOutputs) {
    try {
      const result = await generateText({
          model,
          output: Output.object({ schema: CommitMessageSchema }),
          prompt,
          temperature: aiConfig.temperature,
          maxOutputTokens: aiConfig.maxTokens,
          ...requestOptions(aiConfig),
        });

      const { type: t, scope: s, description: d, body: b } = result.output;
      return formatStructuredCommitMessage(t, s, d, b);
    } catch (err) {
      if (!NoObjectGeneratedError.isInstance(err)) throw err;
    }
  }

  const textResult = await generateText({
      model,
      prompt: prompt + '\n\nRespond with a commit message. Follow the conventional commit format (type(scope): description). If a body is needed, include it after a blank line.',
      temperature: aiConfig.temperature,
      maxOutputTokens: aiConfig.maxTokens,
      ...requestOptions(aiConfig),
    });

  return cleanCommitMessage(textResult.text);
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
  const bullets = deterministicChangeBullets(files);

  if (aiConfig && providerConfig) {
    try {
      const model = getModel(aiConfig, providerConfig);
      const result = await generateText({
          model,
          prompt: buildBulletsPrompt(diff.slice(0, MAX_BULLET_DIFF_CHARS)),
          temperature: 0.3,
          maxOutputTokens: 300,
          ...requestOptions(aiConfig),
        });
      const lines = stripThinking(result.text)
        .split('\n')
        .map(l => l.trim().replace(/^[-•*]\s*/, ''))
        .filter(l => l.length > 0 && l.length < 120 && !/^```/.test(l));
      if (lines.length >= 2) return lines.slice(0, 5);
    } catch {
      // fall through to deterministic bullets
    }
  }

  return bullets.length > 0 ? bullets : ['Updated files'];
}

function deterministicChangeBullets(files: { status: string; path: string }[]): string[] {
  const bullets: string[] = [];
  const added = files.filter(f => f.status === 'A').map(f => f.path);
  const modified = files.filter(f => f.status === 'M').map(f => f.path);
  const deleted = files.filter(f => f.status === 'D').map(f => f.path);

  if (added.length > 0) bullets.push(`Added ${added.length} file${added.length > 1 ? 's' : ''}`);
  if (modified.length > 0) bullets.push(`Modified ${modified.length} file${modified.length > 1 ? 's' : ''}`);
  if (deleted.length > 0) bullets.push(`Deleted ${deleted.length} file${deleted.length > 1 ? 's' : ''}`);

  return bullets;
}

function normalizeAnalysisResult(parsed: unknown): LLMAnalysisResult | null {
  const loose = LooseAnalysisSchema.safeParse(parsed);
  if (!loose.success) return null;

  const issues = loose.data.issues.map((issue) => {
    if (typeof issue === 'string') {
      return { category: 'clarity' as const, severity: 'warning' as const, message: issue };
    }

    const category = normalizeIssueCategory(issue.category);
    const severity = normalizeIssueSeverity(issue.severity);
    return {
      category,
      severity,
      message: issue.message ?? 'Review this commit message for clarity.',
    };
  });

  const validated = AnalysisSchema.safeParse({
    score: Math.max(1, Math.min(10, loose.data.score)),
    issues,
    suggestions: loose.data.suggestions,
    suggestion: loose.data.suggestion ?? undefined,
    whyGood: loose.data.whyGood ?? undefined,
  });
  return validated.success ? validated.data : null;
}

function normalizeIssueCategory(value: string | undefined): IssueCategory {
  if (ISSUE_CATEGORIES.includes(value as IssueCategory)) return value as IssueCategory;
  const normalized = value?.toLowerCase() ?? '';
  if (normalized.includes('vague') || normalized.includes('specific')) return 'specificity';
  if (normalized.includes('scope')) return 'scope';
  if (normalized.includes('body')) return 'body';
  if (normalized.includes('type')) return 'type';
  if (normalized.includes('convention')) return 'convention';
  if (normalized.includes('intent')) return 'intent';
  if (normalized.includes('subject')) return 'subject';
  return 'clarity';
}

function normalizeIssueSeverity(value: string | undefined): IssueSeverity {
  if (ISSUE_SEVERITIES.includes(value as IssueSeverity)) return value as IssueSeverity;
  const normalized = value?.toLowerCase() ?? '';
  if (normalized === 'high' || normalized === 'error') return 'critical';
  if (normalized === 'low' || normalized === 'info') return 'suggestion';
  return 'warning';
}

export function formatStructuredCommitMessage(type: string, scope: string | undefined, description: string, body?: string): string {
  const cleanType = sanitizeCommitType(type);
  const cleanScope = sanitizeCommitScope(scope);
  const scopePart = cleanScope ? `(${cleanScope})` : '';
  const subjectPrefix = `${cleanType}${scopePart}:`;
  const cleanDescription = sanitizeCommitDescription(description, subjectPrefix);
  const subject = `${subjectPrefix} ${cleanDescription || 'update staged changes'}`;
  const cleanBody = sanitizeCommitBody(body, subject);
  return cleanBody ? `${subject}\n\n${cleanBody}` : subject;
}

function sanitizeCommitType(type: string): string {
  const normalized = type.trim().toLowerCase().replace(/[^a-z]/g, '');
  return normalized || 'chore';
}

function sanitizeCommitScope(scope: string | undefined): string | undefined {
  const normalized = scope?.trim().replace(/^\(/, '').replace(/\)$/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
  return normalized || undefined;
}

function sanitizeCommitDescription(description: string, subjectPrefix: string): string {
  let value = cleanCommitMessage(description).split('\n')[0]?.trim() ?? '';
  value = stripSubjectPrefix(value, subjectPrefix).replace(/^[-–—\s]+/, '').trim();
  return value.replace(/\.$/, '').trim();
}

function sanitizeCommitBody(body: string | undefined, subject: string): string {
  if (!body) return '';
  const subjectNormalized = normalizeCommitLine(subject);
  const lines = cleanCommitMessage(body)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd());

  while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
  while (lines.length > 0 && normalizeCommitLine(lines[0]!) === subjectNormalized) {
    lines.shift();
    while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
  }

  const value = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return normalizeCommitLine(value) === subjectNormalized ? '' : value;
}

function stripSubjectPrefix(value: string, subjectPrefix: string): string {
  if (value.toLowerCase().startsWith(subjectPrefix.toLowerCase())) {
    return value.slice(subjectPrefix.length).trim();
  }
  return value.replace(/^\w+(?:\([^)]+\))?!?:\s*/, '').trim();
}

function normalizeCommitLine(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function cleanCommitMessage(text: string): string {
  let value = stripThinking(text).trim();
  const fence = value.match(/```(?:[a-zA-Z]+)?\s*([\s\S]*?)```/);
  if (fence?.[1]) value = fence[1].trim();

  value = value
    .replace(/^commit message:\s*/i, '')
    .replace(/^suggested commit message:\s*/i, '')
    .trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }

  return value;
}

export function extractJson(text: string): unknown | null {
  const withoutThinking = stripThinking(text).trim();
  const codeFence = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeFence?.[1]) {
    const parsed = tryParseJson(codeFence[1]);
    if (parsed !== null) return parsed;
  }

  const direct = tryParseJson(withoutThinking);
  if (direct !== null) return direct;

  const objectText = extractFirstJsonObject(withoutThinking);
  return objectText ? tryParseJson(objectText) : null;
}

function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text.trim());
  } catch {
    try {
      return JSON.parse(repairCommonJsonMistakes(text));
    } catch {
      return null;
    }
  }
}

function repairCommonJsonMistakes(text: string): string {
  return text
    .trim()
    .replace(/"\s*\n\s*"/g, '",\n"')
    .replace(/}\s*\n\s*{/g, '},\n{')
    .replace(/]\s*\n\s*"/g, '],\n"')
    .replace(/}\s*\n\s*"/g, '},\n"');
}

function extractFirstJsonObject(text: string): string | null {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}
