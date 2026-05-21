/**
 * Interactive prompts wrapper
 *
 * Wraps the 'prompts' library for write mode.
 * Provides: text, select, toggle, multiselect inputs.
 */

import prompts from 'prompts';

/**
 * Prompt for commit type.
 */
export async function promptCommitType(): Promise<string> {
  // TODO: Implement
  return '';
}

/**
 * Prompt for scope (optional).
 */
export async function promptScope(): Promise<string | undefined> {
  // TODO: Implement
  return undefined;
}

/**
 * Prompt for description.
 */
export async function promptDescription(): Promise<string> {
  // TODO: Implement
  return '';
}

/**
 * Prompt for accept/edit/regenerate/cancel.
 */
export async function promptAction(): Promise<'accept' | 'edit' | 'regenerate' | 'cancel'> {
  // TODO: Implement
  return 'cancel';
}
