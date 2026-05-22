/**
 * SetupCommand — interactive provider configuration wizard.
 *
 * Prints an environment snippet and can update .env after explicit confirmation.
 */

import { Command, Option } from 'clipanion';
import { select, input, password, confirm } from '@inquirer/prompts';
import { readFile, writeFile, rename, chmod } from 'node:fs/promises';
import pc from 'picocolors';
import { resolveAIConfig, resolveProviderConfig, maskKey, validateAIConfig } from '../config/ai-config';
import { getProviderApiKey, getProviderBaseUrl, getProviderDefinition, isLocalProvider, SETUP_PROVIDERS } from '../config/providers';
import { noColor } from '../utils/env';
import { EXIT_AUTH_ERROR } from '../utils/exit-codes';
import type { AIProvider } from '../types/config';

export class SetupCommand extends Command {
  static paths = [['setup']];
  static usage = Command.Usage({
    category: 'Configuration',
    description: 'Configure an LLM provider',
    details: `
      Guides you through selecting an LLM provider and prints the environment
      variables commit-critic needs. It only writes .env after confirmation.
    `,
    examples: [
      ['Run setup wizard', 'commit-critic setup'],
      ['Print current config only', 'commit-critic setup --non-interactive'],
      ['Fast validation for scripts', 'commit-critic setup --quick'],
    ],
  });

  quick = Option.Boolean('--quick', false, {
    description: 'Return immediately when current provider config is valid',
  });

  nonInteractive = Option.Boolean('--non-interactive', false, {
    description: 'Print current config and required environment variables without prompts',
  });

  async execute() {
    const useColor = !noColor();
    const stdout = this.context.stdout;

    stdout.write('\n');
    stdout.write(useColor ? pc.bold('Current Configuration\n') : 'Current Configuration\n');
    stdout.write('─'.repeat(40) + '\n');

    const aiConfig = resolveAIConfig();
    const providerConfig = resolveProviderConfig(aiConfig.provider);
    const currentBaseUrl = isLocalProvider(aiConfig.provider) ? getProviderBaseUrl(aiConfig.provider, providerConfig) : undefined;
    const currentKey = getProviderApiKey(aiConfig.provider, providerConfig);

    stdout.write(`Provider:  ${aiConfig.provider}\n`);
    stdout.write(`Model:     ${aiConfig.model}\n`);
    if (currentBaseUrl) stdout.write(`Base URL:  ${currentBaseUrl}\n`);
    if (currentKey) stdout.write(`API Key:   ${maskKey(currentKey)}\n`);

    const validationError = validateAIConfig(aiConfig);
    if (this.quick) {
      if (validationError) {
        stdout.write(`\nProvider config is invalid: ${validationError}\n`);
        stdout.write('Run `commit-critic setup` interactively or export the required environment variables.\n');
        process.exit(EXIT_AUTH_ERROR);
      }
      stdout.write('\nProvider config is valid.\n');
      return;
    }

    if (this.nonInteractive) {
      if (validationError) {
        stdout.write(`\nProvider config is invalid: ${validationError}\n`);
        stdout.write('Run `commit-critic setup` interactively or export the required environment variables.\n');
        process.exit(EXIT_AUTH_ERROR);
      }
      stdout.write('\nProvider config is valid.\n');
      return;
    }

    stdout.write('\n');
    const provider = await select<AIProvider>({
      message: 'Select AI provider:',
      choices: SETUP_PROVIDERS.map((providerName) => {
        const definition = getProviderDefinition(providerName);
        return {
          name: definition.label,
          value: definition.name,
          description: definition.description,
        };
      }),
    });

    const envValues: Record<string, string> = { AI_PROVIDER: provider };

    if (isLocalProvider(provider)) {
      const baseUrl = await input({
        message: 'OpenAI-compatible base URL:',
        default: currentBaseUrl ?? getProviderDefinition(provider).defaultBaseUrl,
        required: true,
      });
      envValues.AI_BASE_URL = baseUrl;

      const apiKey = await password({
        message: 'Local API key (leave blank if not required):',
      });
      if (apiKey.trim()) envValues.LOCAL_API_KEY = apiKey.trim();
    } else {
      const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : 'OPENROUTER_API_KEY';
      const apiKey = await password({
        message: `API key (${keyName}):`,
        validate: (value) => value.trim().length > 0 || 'API key is required',
      });
      envValues[keyName] = apiKey;
    }

    const model = await input({
      message: 'Model name:',
      default: getProviderDefinition(provider).defaultModel,
      required: true,
    });
    envValues.AI_MODEL = model;

    stdout.write('\n');
    stdout.write(useColor ? pc.bold('Environment values\n') : 'Environment values\n');
    stdout.write('─'.repeat(40) + '\n');
    for (const [key, value] of Object.entries(envValues)) {
      stdout.write(formatEnvLineForDisplay(key, value) + '\n');
    }
    stdout.write('─'.repeat(40) + '\n');

    const shouldWriteEnv = await confirm({
      message: 'Write these values to .env?',
      default: false,
    });

    if (shouldWriteEnv) {
      await updateEnvFile('.env', envValues);
      stdout.write(useColor ? pc.green('\nUpdated .env.\n') : '\nUpdated .env.\n');
    } else {
      stdout.write('\nNo files changed. Non-secret values are shown above; export API keys from your shell or rerun setup and write .env.\n');
    }
  }
}

function formatEnvLineForDisplay(key: string, value: string): string {
  const displayValue = isSecretEnvKey(key) ? maskKey(value) : value;
  return `${key}=${JSON.stringify(displayValue)}`;
}

function isSecretEnvKey(key: string): boolean {
  return /(API_KEY|TOKEN|SECRET|PASSWORD)$/i.test(key);
}

async function updateEnvFile(path: string, values: Record<string, string>): Promise<void> {
  let existing = '';
  try {
    existing = await readFile(path, 'utf8');
  } catch {
    existing = '';
  }

  const pending = new Map(Object.entries(values));
  const lines = existing.split('\n').map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match) return line;
    const key = match[1];
    const value = pending.get(key);
    if (value === undefined) return line;
    pending.delete(key);
    return `${key}=${value}`;
  });

  const additions = Array.from(pending.entries()).map(([key, value]) => `${key}=${value}`);
  const next = [...lines.filter((line, index) => !(index === lines.length - 1 && line === '')), ...additions].join('\n') + '\n';
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, next, { mode: 0o600 });
  await rename(tmpPath, path);
  await chmod(path, 0o600);
}
