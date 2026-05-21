/**
 * Output formatting tests
 */

import { test, expect } from 'bun:test';
import { buildJsonOutput } from '../ui/json';
import type { AnalysisResult, AnalysisSummary } from '../types/analysis';

function makeResult(subject: string, score: number): AnalysisResult {
  return {
    hash: 'abc123def456',
    shortHash: 'abc1234',
    subject,
    score,
    issues: [],
    suggestions: [],
    isConventionalCommit: subject.includes(':'),
    isMergeCommit: false,
    hasBody: false,
  };
}

const summary: AnalysisSummary = {
  commitCount: 3,
  overallScore: 6.5,
  passed: 1,
  warnings: 1,
  errors: 1,
  topIssues: [{ category: 'subject', count: 2 }],
  durationMs: 100,
};

test('renders JSON output correctly', () => {
  const results = [
    makeResult('feat: add login', 8),
    makeResult('wip', 2),
    makeResult('fix bug', 4),
  ];
  const json = buildJsonOutput('analyze', '/repo', results, summary, '0.1.0');
  expect(json.version).toBe('0.1.0');
  expect(json.command).toBe('analyze');
  expect(json.commitCount).toBe(3);
  expect(json.commits.length).toBe(3);
  expect(json.stats.scoreDistribution).toBeDefined();
  expect(json.stats.vagueCommits).toBe(2);
  expect(json.stats.oneWordCommits).toBe(1);
});

test('JSON output has expected top-level shape', () => {
  const results = [makeResult('feat: add login', 8)];
  const json = buildJsonOutput('analyze', '/repo', results, { ...summary, commitCount: 1 }, '0.1.0');
  expect(json).toHaveProperty('version');
  expect(json).toHaveProperty('command');
  expect(json).toHaveProperty('repo');
  expect(json).toHaveProperty('commitCount');
  expect(json).toHaveProperty('overallScore');
  expect(json).toHaveProperty('summary');
  expect(json).toHaveProperty('commits');
  expect(json).toHaveProperty('stats');
  expect(json).toHaveProperty('topIssues');
  expect(json).toHaveProperty('durationMs');
});
