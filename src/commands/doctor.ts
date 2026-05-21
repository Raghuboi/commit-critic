/**
 * DoctorCommand — health check
 *
 * Checks:
 * 1. Git binary availability
 * 2. Current directory is a git repo
 * 3. LLM provider config (env vars)
 * 4. LLM provider connectivity (optional lightweight call)
 *
 * Output: color-coded health status with fix suggestions
 * Exit: 0 if all pass, 1 if critical failures
 */

import { Command } from 'clipanion';

export class DoctorCommand extends Command {
  static paths = [['doctor']];
  static usage = Command.Usage({
    category: 'Diagnostics',
    description: 'Run health checks',
    details: `
      Verifies git availability, repo detection, and LLM provider configuration.
    `,
    examples: [
      ['Run health checks', 'commit-critic doctor'],
    ],
  });

  async execute() {
    // TODO: Implement doctor checks
    // 1. Check git binary
    // 2. Check current dir is git repo
    // 3. Check LLM provider config
    // 4. Test LLM connectivity (optional)
    this.context.stdout.write('Not implemented yet\n');
  }
}
