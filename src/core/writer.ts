/**
 * Interactive commit writer logic
 *
 * Flow:
 * 1. Read staged diff
 * 2. Prompt user for commit type (select from conventional commit types)
 * 3. Prompt user for scope (text, optional)
 * 4. Prompt user for description (text)
 * 5. Call LLM to generate commit message based on diff + user input
 * 6. Show suggestion
 * 7. Prompt: accept, edit, regenerate, cancel
 */

import { generateCommitMessage } from './llm';
import {
  promptCommitType,
  promptScope,
  promptDescription,
  promptAction,
  promptEdit,
} from '../ui/prompts';
import { truncateDiff, WRITE_MAX_CHARS } from '../utils/diff';
import type { AIConfig, ProviderSpecificConfig } from '../types/config';

type WriterOutput = Pick<NodeJS.WriteStream, 'write'>;

const SUGGESTION_RULE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

export interface WriterOptions {
  preselectedType?: string;
  noLlm?: boolean;
  aiConfig?: AIConfig;
  providerConfig?: ProviderSpecificConfig;
}

export function formatSuggestedCommitMessage(suggestion: string): string {
  return `\nSuggested commit message:\n${SUGGESTION_RULE}\n${suggestion}\n${SUGGESTION_RULE}\n`;
}

/**
 * Run interactive commit writer.
 */
export async function runWriter(diff: string, options: WriterOptions, stdout?: WriterOutput): Promise<string | null> {
  const type = await promptCommitType(options.preselectedType);
  const scope = await promptScope();
  const description = await promptDescription();

  let suggestion: string;
  if (options.noLlm || !options.aiConfig || !options.providerConfig) {
    suggestion = buildTemplateMessage(type, scope, description);
  } else {
    const truncated = truncateDiff(diff, WRITE_MAX_CHARS);
    suggestion = await generateCommitMessage(truncated, type, scope, description, options.aiConfig, options.providerConfig);
  }

  const out = stdout || process.stdout;
  let active = true;
  while (active) {
    out.write(formatSuggestedCommitMessage(suggestion));

    const result = await promptAction(suggestion);
    if (result.action === 'accept') {
      return result.message ?? suggestion;
    }
    if (result.action === 'edit') {
      suggestion = await promptEdit(suggestion);
      continue;
    }
    if (result.action === 'regenerate') {
      if (options.noLlm || !options.aiConfig || !options.providerConfig) {
        suggestion = buildTemplateMessage(type, scope, description);
      } else {
        const truncated = truncateDiff(diff, WRITE_MAX_CHARS);
        suggestion = await generateCommitMessage(truncated, type, scope, description, options.aiConfig, options.providerConfig);
      }
      continue;
    }
    if (result.action === 'cancel') {
      active = false;
    }
  }

  return null;
}

/**
 * Build a template commit message without LLM.
 */
export function buildTemplateMessage(type: string, scope?: string, description?: string): string {
  const scopePart = scope ? `(${scope})` : '';
  const desc = description || 'update';
  return `${type}${scopePart}: ${desc}`;
}
