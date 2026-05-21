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
 */
export async function promptAction(): Promise<'accept' | 'edit' | 'regenerate' | 'cancel'> {
  const answer = await select<'accept' | 'edit' | 'regenerate' | 'cancel'>({
    message: 'What would you like to do?',
    choices: [
      { name: 'Accept', value: 'accept' },
      { name: 'Edit', value: 'edit' },
      { name: 'Regenerate', value: 'regenerate' },
      { name: 'Cancel', value: 'cancel' },
    ],
  });
  return answer;
}

/**
 * Prompt for editing the commit message.
 */
export async function promptEdit(current: string): Promise<string> {
  return input({ message: 'Edit commit message:', default: current });
}
