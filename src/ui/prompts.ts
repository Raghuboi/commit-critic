/**
 * Interactive prompts wrapper
 *
 * Wraps @inquirer/prompts for write mode.
 * Provides: text, select inputs.
 */

import { select, input, confirm } from '@inquirer/prompts';
import { COMMIT_TYPE_OPTIONS, CONVENTIONAL_TYPES_SET } from '../utils/commit-types';

export function isCommitType(value: string | undefined): boolean {
  return Boolean(value && CONVENTIONAL_TYPES_SET.has(value));
}

/**
 * Prompt for commit type.
 */
export async function promptCommitType(preselected?: string): Promise<string> {
  if (preselected) return preselected;
  return select({
    message: 'Select commit type:',
    choices: COMMIT_TYPE_OPTIONS,
  });
}

/**
 * Prompt for scope (optional).
 */
export async function promptScope(preselected?: string): Promise<string | undefined> {
  if (preselected !== undefined) return preselected.trim() || undefined;
  const scope = await input({ message: 'Scope (optional):', default: '' });
  return scope.trim() || undefined;
}

/**
 * Prompt for description.
 */
export async function promptDescription(preselected?: string): Promise<string> {
  if (preselected !== undefined) return preselected.trim();
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
