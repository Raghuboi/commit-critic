/**
 * Output formatting tests
 */

import { describe, test, expect } from 'bun:test';
import { buildJsonOutput } from '../ui/json';
import { renderCommit, renderSummary, renderChangeSummary } from '../ui/output';
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
  llmFallbackCount: 0,
  vagueCommits: 2,
  oneWordCommits: 1,
  conventionalCommits: 1,
  commitsWithBody: 0,
  scoreDistribution: { excellent: 0, good: 1, average: 0, poor: 1, terrible: 1 },
  topIssues: [{ category: 'subject', count: 2 }],
  durationMs: 100,
};

test('JSON output has correct shape, stats, and top-level fields', () => {
  const results = [
    makeResult('feat: add login', 8),
    makeResult('wip', 2),
    makeResult('fix bug', 4),
  ];
  const json = buildJsonOutput('analyze', '/repo', results, summary, '0.1.0');

  // Top-level shape
  expect(json.version).toBe('0.1.0');
  expect(json.command).toBe('analyze');
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

  // Stats match summary
  expect(json.stats.vagueCommits).toBe(summary.vagueCommits);
  expect(json.stats.oneWordCommits).toBe(summary.oneWordCommits);
  expect(json.stats.conventionalCommits).toBe(summary.conventionalCommits);
  expect(json.stats.commitsWithBody).toBe(summary.commitsWithBody);
  expect(json.stats.scoreDistribution).toEqual(summary.scoreDistribution);
});

test('JSON output includes suggestion and whyGood fields', () => {
  const result: AnalysisResult = {
    hash: 'abc123def456',
    shortHash: 'abc1234',
    subject: 'feat: add login',
    score: 8,
    issues: [],
    suggestions: [],
    suggestion: 'Add a body explaining the motivation',
    whyGood: 'Clear scope and imperative mood',
    isConventionalCommit: true,
    isMergeCommit: false,
    hasBody: false,
  };
  const json = buildJsonOutput('analyze', '/repo', [result], { ...summary, commitCount: 1 }, '0.1.0');
  expect(json.commits[0].suggestion).toBe('Add a body explaining the motivation');
  expect(json.commits[0].whyGood).toBe('Clear scope and imperative mood');
});

test('default summary omits verbose-only diagnostic stats', () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => { logs.push(args.join(' ')); };
  try {
    renderSummary(summary, false, false);
  } finally {
    console.log = origLog;
  }
  const output = logs.join('\n');
  expect(output).toContain('Average score: 6.5/10');
  expect(output).toContain('Vague commits: 2');
  expect(output).toContain('One-word commits: 1');
  expect(output).not.toContain('Passed:');
  expect(output).not.toContain('Conventional commits:');
  expect(output).not.toContain('Commits with body:');
  expect(output).not.toContain('Score distribution:');
  expect(output).not.toContain('Analyzed 3 commits');
});

test('change summary uses a single concise heading', () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => { logs.push(args.join(' ')); };
  try {
    renderChangeSummary(
      { filesChanged: 1, insertions: 2, deletions: 0 },
      [{ status: 'A', path: 'src/new.ts' }],
      ['Added 1 file'],
      false
    );
  } finally {
    console.log = origLog;
  }
  const output = logs.join('\n');
  expect(output).toContain('Analyzing staged changes...');
  expect(output).toContain('Changes detected:');
  expect(output).not.toContain('STAGED CHANGES');
  expect(output).not.toContain('Summary:');
});

describe('renderCommit', () => {
  test('bad commit shows Issue: and Better: with rewrite', () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => { logs.push(args.join(' ')); };
    try {
      renderCommit({
        hash: 'abc123',
        shortHash: 'abc1',
        subject: 'wip',
        score: 2,
        issues: [
          {
            category: 'specificity',
            severity: 'critical',
            message: 'Subject is vague ("wip")',
            suggestion: 'Be specific',
            rewrite: 'feat: describe the work-in-progress feature or task',
          },
        ],
        suggestions: [],
        isConventionalCommit: false,
        isMergeCommit: false,
        hasBody: false,
      }, false);
    } finally {
      console.log = origLog;
    }
    const output = logs.join('\n');
    expect(output).toContain('Issue:');
    expect(output).toContain('Better:');
    expect(output).toContain('feat: describe the work-in-progress');
    expect(output).not.toContain('(abc');
    expect(output).not.toContain('Be specific');
  });

  test('good commit shows Why it\'s good:', () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => { logs.push(args.join(' ')); };
    try {
      renderCommit({
        hash: 'def456',
        shortHash: 'def4',
        subject: 'feat(api): add Redis caching',
        score: 9,
        issues: [],
        suggestions: [],
        whyGood: 'Clear scope, specific changes, measurable impact',
        isConventionalCommit: true,
        isMergeCommit: false,
        hasBody: true,
      }, false);
    } finally {
      console.log = origLog;
    }
    const output = logs.join('\n');
    expect(output).toContain("Why it's good:");
    expect(output).toContain('Clear scope');
  });

  test('commit with suggestion uses it for Better:', () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => { logs.push(args.join(' ')); };
    try {
      renderCommit({
        hash: 'ghi789',
        shortHash: 'ghi7',
        subject: 'fixed bug',
        score: 3,
        issues: [
          {
            category: 'specificity',
            severity: 'critical',
            message: 'Too vague',
          },
        ],
        suggestions: [],
        suggestion: 'fix(auth): resolve token expiration handling',
        isConventionalCommit: false,
        isMergeCommit: false,
        hasBody: false,
      }, false);
    } finally {
      console.log = origLog;
    }
    const output = logs.join('\n');
    expect(output).toContain('Better:');
    expect(output).toContain('fix(auth): resolve token expiration handling');
  });
});
