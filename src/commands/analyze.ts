/**
 * AnalyzeCommand — analyze commit message quality
 *
 * Flow:
 * 1. Resolve repo path (current dir or --url)
 * 2. Fetch last N commits (default 50)
 * 3. Run deterministic scoring (always)
 * 4. If LLM available and --no-llm not set: run LLM scoring
 * 5. Combine scores and render results
 *
 * Flags:
 * - --count <n>: number of commits to analyze (default 50)
 * - --url <url>: analyze remote repository
 * - --no-llm: deterministic scoring only
 * - --json: JSON output
 * - --provider <name>: override AI provider
 * - --model <name>: override model ID
 * - --no-merges: exclude merge commits
 */

import { Command, Option } from 'clipanion';
import { getCommits, isGitRepo } from '../core/git';
import { analyzeCommits } from '../core/analyzer';
import { analyzeRemoteRepo, isValidRepoUrl } from '../core/remote';
import { renderAnalysis, status, error } from '../ui/output';
import { formatJson, buildJsonOutput, isPiped } from '../ui/json';
import { resolveAIConfig, validateAIConfig, resolveProviderConfig } from '../config/ai-config';
import type { AIConfig } from '../types/config';
import type { AnalysisResult, AnalysisSummary } from '../types/analysis';
import { version } from '../../package.json';
import { EXIT_SUCCESS, EXIT_GENERAL_ERROR, EXIT_AUTH_ERROR, EXIT_BAD_INPUT } from '../utils/exit-codes';

export class AnalyzeCommand extends Command {
  static paths = [['analyze'], ['a'], ['--analyze']];
  static usage = Command.Usage({
    category: 'Analysis',
    description: 'Analyze commit message quality',
    details: `
      Reviews the last 50 commits (or custom count) and provides AI-powered critique.
      Supports both local and remote repositories.
    `,
    examples: [
      ['Analyze current repo', 'commit-critic analyze'],
      ['Analyze remote repo', 'commit-critic analyze --url https://github.com/user/repo'],
      ['Custom count', 'commit-critic analyze --count 100'],
      ['Deterministic only', 'commit-critic analyze --no-llm'],
      ['JSON output', 'commit-critic analyze --json'],
    ],
  });

  count = Option.String('--count', '50', {
    description: 'Number of commits to analyze (default: 50)',
  });

  url = Option.String('--url', {
    description: 'Remote repository URL to analyze',
  });

  noLlm = Option.Boolean('--no-llm', false, {
    description: 'Deterministic scoring only (no LLM required)',
  });

  json = Option.Boolean('--json', false, {
    description: 'Output as JSON',
  });

  provider = Option.String('--provider', {
    description: 'Override AI provider',
  });

  model = Option.String('--model', {
    description: 'Override model ID',
  });

  noMerges = Option.Boolean('--no-merges', false, {
    description: 'Exclude merge commits from analysis',
  });

  async execute() {
    const startMs = Date.now();
    const repoPath = process.cwd();
    const count = parseInt(this.count, 10);
    if (Number.isNaN(count) || count <= 0) {
      error('Invalid --count value', 'Use a positive integer like --count 50');
      return this.cli.run(['--help']);
    }

    // Resolve AI config
    const aiConfig = resolveAIConfig({
      provider: this.provider,
      model: this.model,
    } as Partial<AIConfig> & { provider?: string });
    const providerConfig = resolveProviderConfig();

    if (!this.noLlm) {
      const validationError = validateAIConfig(aiConfig);
      if (validationError) {
        error(validationError, 'Set the required environment variable or use --no-llm for offline mode.');
        process.exit(EXIT_AUTH_ERROR);
      }
    }

    let commits;
    let repoName = repoPath;

    const useJson = this.json || isPiped();

    try {
      if (this.url) {
        if (!isValidRepoUrl(this.url)) {
          error('Invalid repository URL', 'Use a valid git URL (https://, git@, or file://)');
          process.exit(EXIT_BAD_INPUT);
        }
        status(`Cloning ${this.url}...`, useJson);
        commits = await analyzeRemoteRepo(this.url, async (tempPath) => {
          repoName = this.url!;
          if (!(await isGitRepo(tempPath))) {
            throw new Error('Cloned directory is not a valid git repository');
          }
          return getCommits(tempPath, count, this.noMerges);
        });
      } else {
        if (!(await isGitRepo(repoPath))) {
          error('Not a git repository', 'Run this command inside a git repo or use --url');
          process.exit(EXIT_GENERAL_ERROR);
        }
        commits = await getCommits(repoPath, count, this.noMerges);
      }
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to read commits', 'Check the repository URL and network connection, or use --no-llm for offline mode.');
      process.exit(EXIT_GENERAL_ERROR);
    }

    if (commits.length === 0) {
      status('No commits found.', useJson);
      process.exit(EXIT_SUCCESS);
    }

    status(`Analyzing ${commits.length} commits...`, useJson);

    const { results, fallbackCount } = await analyzeCommits(commits, {
      noLlm: this.noLlm,
      aiConfig: this.noLlm ? undefined : aiConfig,
      providerConfig: this.noLlm ? undefined : providerConfig,
      showProgress: !this.json && !isPiped(),
    });

    const summary = buildSummary(results, fallbackCount, startMs);

    if (useJson) {
      const jsonOutput = buildJsonOutput('analyze', repoName, results, summary, version);
      this.context.stdout.write(formatJson(jsonOutput) + '\n');
    } else {
      renderAnalysis(results, summary);
    }

    // Exit with non-zero if there are errors
    if (summary.errors > 0) {
      process.exit(EXIT_GENERAL_ERROR);
    }
  }
}

function buildSummary(results: AnalysisResult[], fallbackCount: number, startMs: number): AnalysisSummary {
  const scores = results.map(r => r.score);
  const overall = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const passed = results.filter(r => r.score >= 7).length;
  const warnings = results.filter(r => r.score >= 5 && r.score < 7).length;
  const errors = results.filter(r => r.score < 5).length;

  const vagueCommits = results.filter(r => 
    r.issues.some(i => i.category === 'specificity') || 
    r.subject.trim().split(/\s+/).filter(Boolean).length <= 2
  ).length;
  const oneWordCommits = results.filter(r => r.subject.trim().split(/\s+/).filter(Boolean).length === 1).length;
  const conventionalCommits = results.filter(r => r.isConventionalCommit).length;
  const commitsWithBody = results.filter(r => r.hasBody).length;

  const scoreDistribution = {
    excellent: results.filter(r => r.score >= 9).length,
    good: results.filter(r => r.score >= 7 && r.score <= 8).length,
    average: results.filter(r => r.score >= 5 && r.score <= 6).length,
    poor: results.filter(r => r.score >= 3 && r.score <= 4).length,
    terrible: results.filter(r => r.score <= 2).length,
  };

  const categoryCounts = new Map<string, number>();
  for (const r of results) {
    for (const issue of r.issues) {
      categoryCounts.set(issue.category, (categoryCounts.get(issue.category) || 0) + 1);
    }
  }
  const topIssues = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const llmFallbackCount = fallbackCount;

  return {
    commitCount: results.length,
    overallScore: parseFloat(overall.toFixed(1)),
    passed,
    warnings,
    errors,
    llmFallbackCount,
    vagueCommits,
    oneWordCommits,
    conventionalCommits,
    commitsWithBody,
    scoreDistribution,
    topIssues,
    durationMs: Date.now() - startMs,
  };
}
