/**
 * Interactive prompts wrapper
 *
 * Wraps @inquirer/prompts for write mode.
 * Provides: text, select inputs.
 */

import { select, input, confirm } from '@inquirer/prompts';

export const COMMIT_TYPES = [
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
] as const;

const COMMIT_TYPE_VALUES = new Set<string>(COMMIT_TYPES.map((type) => type.value));

export function isCommitType(value: string | undefined): boolean {
  return Boolean(value && COMMIT_TYPE_VALUES.has(value));
}

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

/**
 * Prompt for yes/no confirmation.
 * @param message The confirmation question to display
 * @param defaultYes If true, Enter selects yes; if false, Enter selects no
 */
export async function promptConfirm(message: string, defaultYes = false): Promise<boolean> {
  return confirm({ message, default: defaultYes });
}
