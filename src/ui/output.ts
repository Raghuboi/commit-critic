/**
 * Rich terminal output formatting
 *
 * Uses picocolors for colors.
 * Implements Steel CLI patterns:
 * - Semantic exit codes
 * - Error hints
 * - NO_COLOR support
 * - Status messages to stderr
 */

import pc from 'picocolors';
import type { AnalysisResult, AnalysisSummary } from '../types/analysis';
import { noColor } from '../utils/env';

function c(enabled: boolean, fn: (s: string) => string, text: string): string {
  return enabled ? fn(text) : text;
}

/**
 * Render analysis results to terminal.
 */
export function renderAnalysis(results: AnalysisResult[], summary: AnalysisSummary): void {
  const useColor = !noColor();
  const bad = results.filter(r => r.score < 5);
  const warn = results.filter(r => r.score >= 5 && r.score < 7);
  const good = results.filter(r => r.score >= 7);

  const line = c(useColor, pc.gray, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (bad.length > 0) {
    console.log(`\n${line}`);
    console.log(c(useColor, pc.red, '💩 COMMITS THAT NEED WORK'));
    console.log(line);
    for (const r of bad) renderCommit(r, useColor);
  }

  if (warn.length > 0) {
    console.log(`\n${line}`);
    console.log(c(useColor, pc.yellow, '⚠️  BORDERLINE COMMITS'));
    console.log(line);
    for (const r of warn) renderCommit(r, useColor);
  }

  if (good.length > 0) {
    console.log(`\n${line}`);
    console.log(c(useColor, pc.green, '💎 WELL-WRITTEN COMMITS'));
    console.log(line);
    for (const r of good) renderCommit(r, useColor);
  }

  renderSummary(summary, useColor);
}

/**
 * Render a single commit analysis.
 */
export function renderCommit(result: AnalysisResult, useColor = !noColor()): void {
  const scoreColor = result.score >= 7 ? pc.green : result.score >= 5 ? pc.yellow : pc.red;
  console.log(`\nCommit: "${result.subject}" (${result.shortHash})`);
  console.log(`Score: ${useColor ? scoreColor(String(result.score)) : result.score}/10`);
  for (const issue of result.issues) {
    const icon = issue.severity === 'critical' ? '❌' : issue.severity === 'warning' ? '⚠️' : '💡';
    console.log(`${icon} ${issue.message}`);
    if (issue.suggestion) {
      console.log(`   ${useColor ? pc.gray(`Better: ${issue.suggestion}`) : `Better: ${issue.suggestion}`}`);
    }
  }
  for (const s of result.suggestions) {
    console.log(`   ${useColor ? pc.cyan(`Suggestion: ${s}`) : `Suggestion: ${s}`}`);
  }
}

/**
 * Render analysis summary.
 */
export function renderSummary(summary: AnalysisSummary, useColor = !noColor()): void {
  const line = c(useColor, pc.gray, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const total = summary.commitCount || 1;
  console.log(`\n${line}`);
  console.log(c(useColor, pc.blue, '📊 YOUR STATS'));
  console.log(line);
  console.log(`Average score: ${summary.overallScore.toFixed(1)}/10`);
  console.log(`Passed: ${summary.passed} | Warnings: ${summary.warnings} | Errors: ${summary.errors}`);
  console.log(`Vague commits: ${summary.vagueCommits}/${total} (${Math.round((summary.vagueCommits / total) * 100)}%)`);
  console.log(`One-word commits: ${summary.oneWordCommits}/${total} (${Math.round((summary.oneWordCommits / total) * 100)}%)`);
  console.log(`Conventional commits: ${summary.conventionalCommits}/${total} (${Math.round((summary.conventionalCommits / total) * 100)}%)`);
  console.log(`Commits with body: ${summary.commitsWithBody}/${total} (${Math.round((summary.commitsWithBody / total) * 100)}%)`);
  const d = summary.scoreDistribution;
  console.log(`Score distribution: ${d.excellent} excellent | ${d.good} good | ${d.average} average | ${d.poor} poor | ${d.terrible} terrible`);
  if (summary.topIssues.length > 0) {
    console.log('\nTop issues:');
    for (const issue of summary.topIssues.slice(0, 5)) {
      console.log(`  • ${issue.category}: ${issue.count}`);
    }
  }
  console.log(`\nAnalyzed ${summary.commitCount} commits in ${summary.durationMs}ms`);
}

/**
 * Render staged change summary.
 */
export function renderChangeSummary(
  stats: { filesChanged: number; insertions: number; deletions: number },
  files: { status: string; path: string }[],
  bullets: string[],
  useColor = !noColor()
): void {
  const line = c(useColor, pc.gray, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n${line}`);
  console.log(c(useColor, pc.blue, '📋 STAGED CHANGES'));
  console.log(line);
  console.log(`${stats.filesChanged} files changed, +${stats.insertions} -${stats.deletions} lines`);
  if (files.length > 0) {
    console.log('');
    for (const f of files.slice(0, 20)) {
      const statusColor = f.status === 'A' ? pc.green : f.status === 'D' ? pc.red : f.status === 'R' ? pc.yellow : pc.cyan;
      console.log(`  ${useColor ? statusColor(f.status) : f.status} ${f.path}`);
    }
    if (files.length > 20) {
      console.log(`  ... and ${files.length - 20} more files`);
    }
  }
  if (bullets.length > 0) {
    console.log('');
    console.log('Summary:');
    for (const b of bullets) {
      console.log(`  • ${b}`);
    }
  }
}

/**
 * Print status message to stderr.
 */
export function status(message: string): void {
  process.stderr.write(message + '\n');
}

/**
 * Print error with hint.
 */
export function error(message: string, hint?: string): void {
  const useColor = !noColor();
  process.stderr.write((useColor ? pc.red('Error: ') : 'Error: ') + message + '\n');
  if (hint) {
    process.stderr.write((useColor ? pc.yellow('Hint: ') : 'Hint: ') + hint + '\n');
  }
}
