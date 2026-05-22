/**
 * DoctorCommand — health check for Git and LLM configuration.
 *
 * Critical checks: git binary and repository detection.
 * Warning checks: provider config and connectivity. A missing API key should not
 * make `doctor` unusable as a setup aid.
 */

import { Command } from 'clipanion';
import { isGitRepo } from '../core/git';
import { resolveAIConfig, validateAIConfig, resolveProviderConfig, maskKey } from '../config/ai-config';
import pc from 'picocolors';
import { noColor } from '../utils/env';
import { EXIT_SUCCESS, EXIT_GENERAL_ERROR } from '../utils/exit-codes';
import { getProviderApiKey, getProviderBaseUrl } from '../config/providers';
import type { AIProviderInput, ProviderSpecificConfig } from '../types/config';

function getBaseUrl(provider: AIProviderInput | undefined, config: ProviderSpecificConfig): string {
  return getProviderBaseUrl(provider, config);
}

function getApiKey(provider: AIProviderInput | undefined, config: ProviderSpecificConfig): string | undefined {
  return getProviderApiKey(provider, config);
}

function extractModelIds(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = 'data' in payload ? (payload as { data?: unknown }).data : undefined;
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      if (!item || typeof item !== 'object') return undefined;
      const id = (item as { id?: unknown }).id;
      return typeof id === 'string' ? id : undefined;
    })
    .filter((id): id is string => Boolean(id));
}

export class DoctorCommand extends Command {
  static paths = [['doctor'], ['--doctor']];
  static usage = Command.Usage({
    category: 'Diagnostics',
    description: 'Run Git and LLM provider health checks',
    details: `
      Verifies git availability, repository detection, provider environment variables,
      and provider connectivity when configuration is present.
    `,
    examples: [
      ['Run health checks', 'commit-critic doctor'],
    ],
  });

  async execute() {
    const useColor = !noColor();
    let ok = true;

    const check = (label: string, pass: boolean, message: string, hint?: string, critical = true) => {
      const icon = pass ? (useColor ? pc.green('✓') : '✓') : (useColor ? pc.yellow('!') : '!');
      this.context.stdout.write(`${icon} ${label}: ${message}\n`);
      if (!pass && hint) {
        this.context.stdout.write(`  ${useColor ? pc.yellow('Hint:') : 'Hint:'} ${hint}\n`);
      }
      if (!pass && critical) ok = false;
    };

    try {
      const proc = Bun.spawn(['git', '--version'], { stdout: 'pipe', stderr: 'pipe' });
      const exitCode = await proc.exited;
      check('Git', exitCode === 0, exitCode === 0 ? 'Available' : 'Not found', 'Install git and ensure it is in your PATH');
    } catch {
      check('Git', false, 'Not found', 'Install git and ensure it is in your PATH');
    }

    const repoPath = process.cwd();
    const repo = await isGitRepo(repoPath);
    check('Repository', repo, repo ? 'Git repository detected' : 'Not a git repository', 'Run inside a git repo or use analyze --url');

    const aiConfig = resolveAIConfig();
    const providerConfig = resolveProviderConfig(aiConfig.requestedProvider);
    const validationError = validateAIConfig(aiConfig);
    check(
      'Provider config',
      !validationError,
      validationError ? validationError : `${aiConfig.provider} / ${aiConfig.model}`,
      validationError ? 'Run `commit-critic setup` or export the required environment variables.' : undefined,
      false
    );

    if (providerConfig.openaiApiKey) this.context.stdout.write(`  OPENAI_API_KEY=${maskKey(providerConfig.openaiApiKey)}\n`);
    if (providerConfig.openrouterApiKey) this.context.stdout.write(`  OPENROUTER_API_KEY=${maskKey(providerConfig.openrouterApiKey)}\n`);
    if (providerConfig.localBaseUrl && aiConfig.provider === 'local') this.context.stdout.write(`  AI_BASE_URL=${providerConfig.localBaseUrl}\n`);
    if (providerConfig.localApiKey && aiConfig.provider === 'local') this.context.stdout.write(`  LOCAL_API_KEY=${maskKey(providerConfig.localApiKey)}\n`);

    if (!validationError) {
      const baseUrl = getBaseUrl(aiConfig.requestedProvider ?? aiConfig.provider, providerConfig);
      const headers: Record<string, string> = {};
      const apiKey = getApiKey(aiConfig.requestedProvider ?? aiConfig.provider, providerConfig);
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      try {
        const start = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(`${baseUrl}/models`, { headers, signal: controller.signal });
        clearTimeout(timer);
        const ms = Date.now() - start;
        check('Connectivity', resp.ok, `${baseUrl} (${ms}ms)`, resp.ok ? undefined : `Server returned ${resp.status}`, false);
        if (resp.ok && aiConfig.provider === 'local') {
          const modelIds = extractModelIds(await resp.json());
          if (modelIds.length > 0) {
            this.context.stdout.write(`  Available local models: ${modelIds.slice(0, 5).join(', ')}\n`);
          }
        }
      } catch {
        check('Connectivity', false, 'Unreachable', 'Check that the server is running and AI_BASE_URL is correct.', false);
      }
    }

    process.exit(ok ? EXIT_SUCCESS : EXIT_GENERAL_ERROR);
  }
}
