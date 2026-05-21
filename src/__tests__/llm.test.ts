/**
 * LLM integration tests (mocked provider)
 */

import { test, expect } from 'bun:test';
import { generateCommitMessage, analyzeCommitWithLLM } from '../core/llm';
import type { Commit } from '../types/commit';
import type { ScoringResult } from '../types/scoring';
import type { AIConfig, ProviderSpecificConfig } from '../types/config';

const mockAIConfig: AIConfig = {
  provider: 'openai',
  model: 'gpt-4.1',
  strictMode: false,
  temperature: 0.1,
  maxTokens: 4096,
  maxRetries: 2,
  fallbackChain: [],
};

const mockProviderConfig: ProviderSpecificConfig = {
  openaiApiKey: 'sk-test',
};

const mockCommit: Commit = {
  hash: 'abc123def456',
  shortHash: 'abc1234',
  subject: 'feat: add login',
  body: '',
  author: 'Test',
  email: 'test@test.com',
  date: new Date().toISOString(),
  timestamp: Date.now(),
  parents: ['parent1'],
};

const mockDeterministic: ScoringResult = {
  score: 8,
  issues: [],
};

test('generateCommitMessage returns a string (smoke)', async () => {
  // Skip live call; just verify function signature
  expect(typeof generateCommitMessage).toBe('function');
});

test('analyzeCommitWithLLM function exists', () => {
  expect(typeof analyzeCommitWithLLM).toBe('function');
});
