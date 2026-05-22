import { describe, expect, test } from 'bun:test';
import { buildAnalysisPrompt, buildWritePrompt } from '../core/prompts';
import type { Commit } from '../types/commit';
import type { ScoringResult } from '../types/scoring';

const commit: Commit = {
  hash: 'abc123def456',
  shortHash: 'abc123d',
  subject: 'fixed bug',
  body: '',
  author: 'Raghuboi',
  email: 'raghuboirs@example.com',
  date: '2026-05-22T00:00:00.000Z',
  timestamp: 1789948800,
  parents: ['parent'],
};

const deterministic: ScoringResult = {
  score: 2,
  issues: [
    {
      category: 'specificity',
      severity: 'critical',
      message: 'Too vague to explain the change',
    },
  ],
};

describe('buildAnalysisPrompt', () => {
  test('includes explicit JSON output contract', () => {
    const prompt = buildAnalysisPrompt(commit, deterministic);

    expect(prompt).toContain('Respond with exactly one valid JSON object');
    expect(prompt).toContain('Do not include markdown fences');
    expect(prompt).toContain('Use issue categories from:');
    expect(prompt).toContain('Treat deterministic checks as a baseline signal');
  });

  test('includes commit context and deterministic baseline', () => {
    const prompt = buildAnalysisPrompt(commit, deterministic);

    expect(prompt).toContain('Commit subject: "fixed bug"');
    expect(prompt).toContain('Score: 2/10');
    expect(prompt).toContain('Too vague to explain the change');
  });
});

describe('buildWritePrompt prompt structure', () => {
  test('includes examples and anti-hallucination guidance', () => {
    const prompt = buildWritePrompt('diff --git a/README.md b/README.md\n+docs', 'docs', 'readme', 'clarify setup');

    expect(prompt).toContain('Examples:');
    expect(prompt).toContain('docs(readme): clarify setup instructions');
    expect(prompt).toContain('If the diff is tiny');
    expect(prompt).toContain('avoid inventing hidden details');
    expect(prompt).toContain('Return ONLY the commit message');
  });
});
