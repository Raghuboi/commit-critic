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
import { isGitRepo } from '../core/git';
import { resolveAIConfig, validateAIConfig, resolveProviderConfig, maskKey } from '../config/ai-config';
import pc from 'picocolors';
import { noColor } from '../utils/env';

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
    const useColor = !noColor();
    let ok = true;

    const check = (label: string, pass: boolean, message: string, hint?: string) => {
      const icon = pass ? (useColor ? pc.green('✓') : '✓') : (useColor ? pc.red('✗') : '✗');
      this.context.stdout.write(`${icon} ${label}: ${message}\n`);
      if (!pass && hint) {
        this.context.stdout.write(`  ${useColor ? pc.yellow('Hint:') : 'Hint:'} ${hint}\n`);
      }
      if (!pass) ok = false;
    };

    // Git binary
    try {
      const proc = Bun.spawn(['git', '--version'], { stdout: 'pipe', stderr: 'pipe' });
      const exitCode = await proc.exited;
      check('Git', exitCode === 0, exitCode === 0 ? 'Available' : 'Not found', 'Install git and ensure it is in your PATH');
    } catch {
      check('Git', false, 'Not found', 'Install git and ensure it is in your PATH');
    }

    // Git repo
    const repoPath = process.cwd();
    const repo = await isGitRepo(repoPath);
    check('Repository', repo, repo ? 'Git repository detected' : 'Not a git repository', 'Run inside a git repo or use --url');

    // Provider config
    const aiConfig = resolveAIConfig();
    const providerConfig = resolveProviderConfig();
    const validationError = validateAIConfig(aiConfig);
    check(
      'Provider config',
      !validationError,
      validationError ? validationError : `${aiConfig.provider} / ${aiConfig.model}`,
      validationError ? 'Set the required environment variable or use --no-llm' : undefined
    );

    // Show env vars (masked)
    if (providerConfig.openaiApiKey) {
      this.context.stdout.write(`  OPENAI_API_KEY=${maskKey(providerConfig.openaiApiKey)}\n`);
    }
    if (providerConfig.openrouterApiKey) {
      this.context.stdout.write(`  OPENROUTER_API_KEY=${maskKey(providerConfig.openrouterApiKey)}\n`);
    }
    if (providerConfig.lmstudioBaseUrl) {
      this.context.stdout.write(`  LM_STUDIO_BASE_URL=${providerConfig.lmstudioBaseUrl}\n`);
    }
    if (providerConfig.vllmBaseUrl) {
      this.context.stdout.write(`  VLLM_BASE_URL=${providerConfig.vllmBaseUrl}\n`);
    }
    if (providerConfig.ollamaBaseUrl) {
      this.context.stdout.write(`  OLLAMA_BASE_URL=${providerConfig.ollamaBaseUrl}\n`);
    }

    process.exit(ok ? 0 : 1);
  }
}
