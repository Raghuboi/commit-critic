import { test, expect } from 'bun:test';
import { buildJsonOutput } from '../ui/json';
import { renderCommit, renderSummary } from '../ui/output';
import type { AnalysisResult, AnalysisSummary } from '../types/analysis';

const summary: AnalysisSummary = {
  commitCount: 3,
  overallScore: 6.5,
  passed: 1,
  warnings: 1,
  errors: 1,
  llmFallbackCount: 0,
  vagueCommits: 2,
  oneWordCommits: 1,
  conventionalCommits: 1,
  commitsWithBody: 0,
  scoreDistribution: { excellent: 0, good: 1, average: 0, poor: 1, terrible: 1 },
  topIssues: [{ category: 'subject', count: 2 }],
  durationMs: 100,
};

function captureLogs(fn: () => void): string {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => { logs.push(args.join(' ')); };
  try {
    fn();
  } finally {
    console.log = originalLog;
  }
  return logs.join('\n');
}

test('JSON output exposes the documented top-level fields', () => {
  const result: AnalysisResult = {
    hash: 'abc123def456',
    shortHash: 'abc1234',
    subject: 'feat: add login',
    score: 8,
    issues: [],
    suggestions: [],
    isConventionalCommit: true,
    isMergeCommit: false,
    hasBody: false,
  };

  const json = buildJsonOutput('analyze', '/repo', [result], summary, '0.1.0');

  expect(Object.keys(json)).toEqual([
    'version',
    'command',
    'repo',
    'commitCount',
    'overallScore',
    'summary',
    'commits',
    'stats',
    'topIssues',
    'durationMs',
  ]);
  expect(json.stats.vagueCommits).toBe(2);
  expect(json.stats.oneWordCommits).toBe(1);
});

test('terminal report keeps the required commit-quality sections', () => {
  const statsOutput = captureLogs(() => renderSummary(summary, false, false));
  expect(statsOutput).toContain('📊 YOUR STATS');
  expect(statsOutput).toContain('Average score: 6.5/10');
  expect(statsOutput).toContain('Vague commits: 2');
  expect(statsOutput).toContain('One-word commits: 1');

  const weakOutput = captureLogs(() => renderCommit({
    hash: 'abc123',
    shortHash: 'abc1',
    subject: 'wip',
    score: 2,
    issues: [{
      category: 'specificity',
      severity: 'critical',
      message: 'Subject is vague ("wip")',
      rewrite: 'feat: describe the work in progress',
    }],
    suggestions: [],
    isConventionalCommit: false,
    isMergeCommit: false,
    hasBody: false,
  }, false));
  expect(weakOutput).toContain('Commit: "wip"');
  expect(weakOutput).toContain('Issue:');
  expect(weakOutput).toContain('Better:');

  const goodOutput = captureLogs(() => renderCommit({
    hash: 'def456',
    shortHash: 'def4',
    subject: 'feat(api): add Redis caching',
    score: 9,
    issues: [],
    suggestions: [],
    whyGood: 'Clear scope and specific change',
    isConventionalCommit: true,
    isMergeCommit: false,
    hasBody: true,
  }, false));
  expect(goodOutput).toContain("Why it's good:");
});
