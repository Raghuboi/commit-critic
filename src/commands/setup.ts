/**
 * SetupCommand — interactive provider configuration wizard
 *
 * Guides users through provider selection and configuration,
 * then prints export commands for their shell config.
 *
 * Does NOT save to .env directly — only prints the commands.
 */

import { Command } from 'clipanion';
import { select, input } from '@inquirer/prompts';
import pc from 'picocolors';
import { resolveAIConfig, resolveProviderConfig, maskKey } from '../config/ai-config';
import { noColor } from '../utils/env';
import type { AIProvider } from '../types/config';

const PROVIDERS: { name: string; value: AIProvider; description: string }[] = [
  { name: 'OpenAI', value: 'openai', description: 'OpenAI API (requires API key)' },
  { name: 'OpenRouter', value: 'openrouter', description: 'OpenRouter (requires API key)' },
  { name: 'LM Studio', value: 'lmstudio', description: 'Local LM Studio server' },
  { name: 'vLLM', value: 'vllm', description: 'Local vLLM server' },
  { name: 'Ollama', value: 'ollama', description: 'Local Ollama server' },
  { name: 'llama.cpp', value: 'llamacpp', description: 'Local llama.cpp server' },
];

const DEFAULT_BASE_URLS: Record<string, string> = {
  lmstudio: 'http://localhost:1234/v1',
  vllm: 'http://localhost:8000/v1',
  ollama: 'http://localhost:11434/v1',
  llamacpp: 'http://localhost:8081/v1',
};

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4.1',
  openrouter: 'anthropic/claude-3-haiku',
  lmstudio: 'local-model',
  vllm: 'meta-llama/Llama-3.1-8B-Instruct',
  ollama: 'llama3.1',
  llamacpp: 'llama-3.1-8B-Instruct',
};

const PROVIDER_KEYS: Record<string, { urlKey?: string; keyEnv?: string }> = {
  openai: { keyEnv: 'OPENAI_API_KEY' },
  openrouter: { keyEnv: 'OPENROUTER_API_KEY' },
  lmstudio: { urlKey: 'LM_STUDIO_BASE_URL' },
  vllm: { urlKey: 'VLLM_BASE_URL' },
  ollama: { urlKey: 'OLLAMA_BASE_URL' },
  llamacpp: { urlKey: 'LLAMACPP_BASE_URL' },
};

export class SetupCommand extends Command {
  static paths = [['setup']];
  static usage = Command.Usage({
    category: 'Configuration',
    description: 'Interactive provider configuration wizard',
    details: `
      Guides you through selecting and configuring an AI provider.
      Prints export commands to add to your shell config (~/.bashrc, ~/.zshrc, etc.).
      Does NOT modify any files directly.
    `,
    examples: [
      ['Run setup wizard', 'commit-critic setup'],
    ],
  });

  async execute() {
    const useColor = !noColor();
    const stdout = this.context.stdout;

    // Show current config
    stdout.write('\n');
    if (useColor) {
      stdout.write(pc.bold('Current Configuration\n'));
    } else {
      stdout.write('Current Configuration\n');
    }
    stdout.write('─'.repeat(40) + '\n');

    const aiConfig = resolveAIConfig();
    const providerConfig = resolveProviderConfig();

    stdout.write(`Provider:  ${aiConfig.provider}\n`);
    stdout.write(`Model:     ${aiConfig.model}\n`);

    // Show current base URLs if set
    const currentUrl = this.getCurrentBaseUrl(aiConfig.provider, providerConfig);
    if (currentUrl) {
      stdout.write(`Base URL:  ${currentUrl}\n`);
    }

    // Show current API key if set (masked)
    const currentKey = this.getCurrentApiKey(aiConfig.provider, providerConfig);
    if (currentKey) {
      stdout.write(`API Key:   ${maskKey(currentKey)}\n`);
    }

    stdout.write('\n');

    // Provider selection
    const provider = await select({
      message: 'Select AI provider:',
      choices: PROVIDERS.map((p) => ({
        name: p.name,
        value: p.value,
        description: p.description,
      })),
    });

    // Provider-specific prompts
    let baseUrl: string | undefined;
    let apiKey: string | undefined;

    const providerInfo = PROVIDER_KEYS[provider];

    if (providerInfo.urlKey) {
      const defaultUrl = DEFAULT_BASE_URLS[provider];
      baseUrl = await input({
        message: `Base URL (${provider} server):`,
        default: defaultUrl,
        required: true,
      });
    } else if (providerInfo.keyEnv) {
      apiKey = await input({
        message: `API Key (${providerInfo.keyEnv}):`,
        required: true,
      });
    }

    // Model name
    const defaultModel = DEFAULT_MODELS[provider];
    const model = await input({
      message: 'Model name:',
      default: defaultModel,
      required: true,
    });

    // Print export commands
    stdout.write('\n');
    if (useColor) {
      stdout.write(pc.bold('Add these to your shell config (~/.bashrc, ~/.zshrc, etc.):\n'));
    } else {
      stdout.write('Add these to your shell config (~/.bashrc, ~/.zshrc, etc.):\n');
    }
    stdout.write('─'.repeat(40) + '\n');
    stdout.write('\n');

    stdout.write('# Provider\n');
    stdout.write(`export AI_PROVIDER="${provider}"\n`);
    stdout.write('\n');

    stdout.write('# Model\n');
    stdout.write(`export AI_MODEL="${model}"\n`);
    stdout.write('\n');

    if (baseUrl) {
      stdout.write('# Base URL\n');
      stdout.write(`export ${providerInfo.urlKey}="${baseUrl}"\n`);
      stdout.write('\n');
    }

    if (apiKey) {
      stdout.write('# API Key\n');
      stdout.write(`export ${providerInfo.keyEnv}="${apiKey}"\n`);
      stdout.write('\n');
    }

    stdout.write('─'.repeat(40) + '\n');
    stdout.write('\n');
    if (useColor) {
      stdout.write(pc.green('Setup complete! Restart your shell or source your config file.\n'));
    } else {
      stdout.write('Setup complete! Restart your shell or source your config file.\n');
    }
  }

  private getCurrentBaseUrl(provider: string, config: ReturnType<typeof resolveProviderConfig>): string | undefined {
    switch (provider) {
      case 'lmstudio': return config.lmstudioBaseUrl;
      case 'vllm': return config.vllmBaseUrl;
      case 'ollama': return config.ollamaBaseUrl;
      default: return undefined;
    }
  }

  private getCurrentApiKey(provider: string, config: ReturnType<typeof resolveProviderConfig>): string | undefined {
    switch (provider) {
      case 'openai': return config.openaiApiKey;
      case 'openrouter': return config.openrouterApiKey;
      default: return undefined;
    }
  }
}
