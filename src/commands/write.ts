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

export class WriteCommand extends Command {
  static paths = [['write'], ['w']];
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
    // TODO: Implement write logic
    // 1. Check staged changes
    // 2. Interactive prompts
    // 3. LLM suggestion
    // 4. Accept/edit/regenerate flow
    this.context.stdout.write('Not implemented yet\n');
  }
}
