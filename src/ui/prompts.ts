/**
 * Interactive prompts wrapper
 *
 * Wraps @inquirer/prompts for write mode.
 * Provides: text, select inputs.
 */

import { select, input } from '@inquirer/prompts';

const COMMIT_TYPES = [
  { name: 'feat', value: 'feat', description: 'A new feature' },
  { name: 'fix', value: 'fix', description: 'A bug fix' },
  { name: 'docs', value: 'docs', description: 'Documentation only changes' },
  { name: 'style', value: 'style', description: 'Code style changes' },
  { name: 'refactor', value: 'refactor', description: 'Code refactoring' },
  { name: 'perf', value: 'perf', description: 'Performance improvements' },
  { name: 'test', value: 'test', description: 'Adding or updating tests' },
  { name: 'build', value: 'build', description: 'Build system changes' },
  { name: 'ci', value: 'ci', description: 'CI/CD changes' },
  { name: 'chore', value: 'chore', description: 'Other changes' },
  { name: 'revert', value: 'revert', description: 'Revert a commit' },
];

/**
 * Prompt for commit type.
 */
export async function promptCommitType(preselected?: string): Promise<string> {
  if (preselected) return preselected;
  return select({
    message: 'Select commit type:',
    choices: COMMIT_TYPES,
  });
}

/**
 * Prompt for scope (optional).
 */
export async function promptScope(): Promise<string | undefined> {
  const scope = await input({ message: 'Scope (optional):', default: '' });
  return scope.trim() || undefined;
}

/**
 * Prompt for description.
 */
export async function promptDescription(): Promise<string> {
  return input({ message: 'Brief description of changes:' });
}

/**
 * Prompt for accept/edit/regenerate/cancel.
 * Enter = accept, type text = custom message, /e = edit, /r = regenerate, /c = cancel.
 */
export async function promptAction(suggestion: string): Promise<{ action: 'accept'; message?: string } | { action: 'edit' } | { action: 'regenerate' } | { action: 'cancel' }> {
  const answer = await input({
    message: `Press Enter to accept, type a custom message, or /e=edit /r=regenerate /c=cancel:`,
    default: suggestion,
  });
  const trimmed = answer.trim();
  if (trimmed === '/e') return { action: 'edit' };
  if (trimmed === '/r') return { action: 'regenerate' };
  if (trimmed === '/c') return { action: 'cancel' };
  if (trimmed === suggestion.trim()) return { action: 'accept' };
  if (trimmed === '') return { action: 'accept' };
  return { action: 'accept', message: trimmed };
}

/**
 * Prompt for editing the commit message.
 */
export async function promptEdit(current: string): Promise<string> {
  return input({ message: 'Edit commit message:', default: current });
}
