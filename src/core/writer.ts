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

import prompts from 'prompts';

/**
 * Conventional commit types.
 */
const COMMIT_TYPES = [
  { title: 'feat', value: 'feat' },
  { title: 'fix', value: 'fix' },
  { title: 'docs', value: 'docs' },
  { title: 'style', value: 'style' },
  { title: 'refactor', value: 'refactor' },
  { title: 'perf', value: 'perf' },
  { title: 'test', value: 'test' },
  { title: 'build', value: 'build' },
  { title: 'ci', value: 'ci' },
  { title: 'chore', value: 'chore' },
  { title: 'revert', value: 'revert' },
];

/**
 * Run interactive commit writer.
 */
export async function runWriter(_diff: string, _preselectedType?: string): Promise<string | null> {
  // TODO: Implement interactive prompts
  // 1. Select commit type
  // 2. Enter scope (optional)
  // 3. Enter description
  // 4. Call LLM for suggestion
  // 5. Show suggestion
  // 6. Accept/edit/regenerate/cancel
  return null;
}

/**
 * Generate commit message suggestion from LLM.
 */
export async function generateSuggestion(
  _diff: string,
  _type: string,
  _scope?: string,
  _description?: string
): Promise<string> {
  // TODO: Implement LLM call for commit message generation
  return '';
}
