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
export function renderAnalysis(results: AnalysisResult[], summary: AnalysisSummary, verbose = false): void {
  const useColor = !noColor();
  const needsWork = results.filter(r => r.score < 7);
  const good = results.filter(r => r.score >= 7);

  const line = c(useColor, pc.gray, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (needsWork.length > 0) {
    console.log(`\n${line}`);
    console.log(c(useColor, pc.red, '💩 COMMITS THAT NEED WORK'));
    console.log(line);
    for (const r of needsWork) renderCommit(r, useColor);
  }

  if (good.length > 0) {
    console.log(`\n${line}`);
    console.log(c(useColor, pc.green, '💎 WELL-WRITTEN COMMITS'));
    console.log(line);
    for (const r of good) renderCommit(r, useColor);
  }

  renderSummary(summary, useColor, verbose);
}

/**
 * Render a single commit analysis.
 */
export function renderCommit(result: AnalysisResult, useColor = !noColor()): void {
  const scoreColor = result.score >= 7 ? pc.green : result.score >= 5 ? pc.yellow : pc.red;
  console.log(`\nCommit: "${result.subject}"`);
  console.log(`Score: ${useColor ? scoreColor(String(result.score)) : result.score}/10`);

  const isGood = result.score >= 7;

  if (!isGood) {
    // Show all issues with Issue: label for commits that need work
    for (const issue of result.issues) {
      console.log(`Issue: ${issue.message}`);
    }
    // Show Better: once from the first issue that has a rewrite
    const betterLine = result.suggestion
      || result.issues.find(i => i.rewrite)?.rewrite;
    if (betterLine) {
      console.log(`Better: "${betterLine}"`);
    }
  } else {
    // Show minor suggestions with emoji for well-written commits
    for (const issue of result.issues) {
      const icon = issue.severity === 'critical' ? '❌' : issue.severity === 'warning' ? '⚠️' : '💡';
      console.log(`${icon} ${issue.message}`);
    }
  }

  // Show Why it's good: for well-written commits
  if (isGood) {
    const why = result.whyGood || buildDeterministicWhyGood(result);
    if (why) {
      console.log(`Why it's good: ${why}`);
    }
  }
}

/**
 * Build a deterministic "Why it's good" summary from scoring result.
 */
function buildDeterministicWhyGood(result: AnalysisResult): string | undefined {
  const positives: string[] = [];
  if (result.isConventionalCommit) positives.push('uses conventional commit format');
  if (result.hasBody) positives.push('includes explanatory body');
  if (result.subject.length >= 10 && result.subject.length <= 50) positives.push('concise subject');
  if (result.issues.length === 0) positives.push('no quality issues detected');

  if (positives.length === 0) return undefined;
  // Capitalize first positive, join the rest
  const first = positives[0][0].toUpperCase() + positives[0].slice(1);
  if (positives.length === 1) return first;
  return `${first}, ${positives.slice(1).join(', ')}`;
}

/**
 * Render analysis summary.
 */
export function renderSummary(summary: AnalysisSummary, useColor = !noColor(), verbose = false): void {
  const line = c(useColor, pc.gray, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const total = summary.commitCount || 1;
  console.log(`\n${line}`);
  console.log(c(useColor, pc.blue, '📊 YOUR STATS'));
  console.log(line);
  console.log(`Average score: ${summary.overallScore.toFixed(1)}/10`);

  if (verbose) {
    console.log(`Passed: ${summary.passed} | Warnings: ${summary.warnings} | Errors: ${summary.errors}`);
  }

  console.log(`Vague commits: ${summary.vagueCommits} (${Math.round((summary.vagueCommits / total) * 100)}%)`);
  console.log(`One-word commits: ${summary.oneWordCommits} (${Math.round((summary.oneWordCommits / total) * 100)}%)`);

  if (verbose) {
    console.log(`Conventional commits: ${summary.conventionalCommits} (${Math.round((summary.conventionalCommits / total) * 100)}%)`);
    console.log(`Commits with body: ${summary.commitsWithBody} (${Math.round((summary.commitsWithBody / total) * 100)}%)`);
    const d = summary.scoreDistribution;
    console.log(`Score distribution: ${d.excellent} excellent | ${d.good} good | ${d.average} average | ${d.poor} poor | ${d.terrible} terrible`);
    if (summary.llmFallbackCount > 0) {
      console.log(`LLM fallback used for ${summary.llmFallbackCount} commit${summary.llmFallbackCount > 1 ? 's' : ''} (deterministic scoring)`);
    }
    if (summary.topIssues.length > 0) {
      console.log('\nTop issues:');
      for (const issue of summary.topIssues.slice(0, 5)) {
        console.log(`  • ${issue.category}: ${issue.count}`);
      }
    }
    console.log(`\nAnalyzed ${summary.commitCount} commits in ${summary.durationMs}ms`);
  }
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
  console.log(`\nAnalyzing staged changes... (${stats.filesChanged} files changed, +${stats.insertions} -${stats.deletions} lines)`);
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
    console.log('Changes detected:');
    for (const b of bullets) {
      console.log(`  • ${b}`);
    }
  }
}

/**
 * Print status message to stderr (suppressed in JSON mode).
 */
export function status(message: string, suppress = false): void {
  if (!suppress) process.stderr.write(message + '\n');
}

/**
 * Print warning message to stderr.
 */
export function warn(message: string): void {
  const useColor = !noColor();
  process.stderr.write((useColor ? pc.yellow('Warning: ') : 'Warning: ') + message + '\n');
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
