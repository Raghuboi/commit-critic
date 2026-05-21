/**
 * WriteCommand — interactive commit writer
 *
 * Flow:
 * 1. Check for staged changes (git diff --staged)
 * 2. If no staged changes: error + exit 1
 * 3. Prompt user for commit type (select)
 * 4. Prompt user for scope (text, optional)
 * 5. Prompt user for description (text)
 * 6. Read staged diff, truncate if >50K chars
 * 7. Call LLM to generate commit message
 * 8. Show suggestion to user
 * 9. Prompt: accept, edit, regenerate, or cancel
 * 10. If accept: output message (do NOT auto-commit)
 *
 * Flags:
 * - --type <type>: pre-select commit type
 * - --no-llm: skip LLM suggestion, use template only
 * - --provider <name>: override AI provider
 * - --model <name>: override model ID
 */

import { Command, Option } from 'clipanion';
import { getStagedDiff, hasStagedChanges, getStagedStats, getStagedFiles } from '../core/git';
import { runWriter } from '../core/writer';
import { generateChangeBullets } from '../core/llm';
import { resolveAIConfig, validateAIConfig, resolveProviderConfig } from '../config/ai-config';
import { error, renderChangeSummary } from '../ui/output';
import { EXIT_SUCCESS, EXIT_GENERAL_ERROR, EXIT_AUTH_ERROR } from '../utils/exit-codes';

export class WriteCommand extends Command {
  static paths = [['write'], ['w'], ['--write']];
  static usage = Command.Usage({
    category: 'Writing',
    description: 'Interactive commit message writer',
    details: `
      Analyzes staged changes and suggests a well-formatted commit message.
      Does NOT auto-commit — user controls the commit.
    `,
    examples: [
      ['Interactive writer', 'commit-critic write'],
      ['Pre-select type', 'commit-critic write --type feat'],
    ],
  });

  type = Option.String('--type', {
    description: 'Pre-select commit type (feat, fix, docs, etc.)',
  });

  noLlm = Option.Boolean('--no-llm', false, {
    description: 'Skip LLM suggestion, use template only',
  });

  provider = Option.String('--provider', {
    description: 'Override AI provider',
  });

  model = Option.String('--model', {
    description: 'Override model ID',
  });

  async execute() {
    const repoPath = process.cwd();

    if (!(await hasStagedChanges(repoPath))) {
      error('No staged changes', 'Stage changes with git add before running write');
      process.exit(EXIT_GENERAL_ERROR);
    }

    const aiConfig = resolveAIConfig({
      provider: this.provider,
      model: this.model,
    });
    const providerConfig = resolveProviderConfig();

    if (!this.noLlm) {
      const validationError = validateAIConfig(aiConfig);
      if (validationError) {
        error(validationError, 'Set the required environment variable or use --no-llm for offline mode.');
        process.exit(EXIT_AUTH_ERROR);
      }
    }

    let diff: string;
    try {
      diff = await getStagedDiff(repoPath);
    } catch (err: any) {
      error(err.message || 'Failed to read staged diff', 'Ensure you are in a git repository with staged changes (git add)');
      process.exit(EXIT_GENERAL_ERROR);
    }

    // Show staged change summary before prompts
    const stats = await getStagedStats(repoPath);
    const files = await getStagedFiles(repoPath);
    const bullets = await generateChangeBullets(
      diff,
      files,
      this.noLlm ? undefined : aiConfig,
      this.noLlm ? undefined : providerConfig
    );
    renderChangeSummary(stats, files, bullets);

    const message = await runWriter(diff, {
      preselectedType: this.type,
      noLlm: this.noLlm,
      aiConfig: this.noLlm ? undefined : aiConfig,
      providerConfig: this.noLlm ? undefined : providerConfig,
    });

    if (message) {
      this.context.stdout.write(message + '\n');
    } else {
      process.exit(EXIT_SUCCESS);
    }
  }
}
