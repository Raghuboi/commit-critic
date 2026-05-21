/**
 * App config resolution
 *
 * Handles:
 * - Config directory location (~/.config/commit-critic)
 * - JSON output flag
 * - Verbose mode
 * - NO_COLOR support
 */

import { getEnvBool, isTTY, noColor } from '../utils/env';
import type { AppConfig } from '../types/config';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_CONFIG_DIR = join(homedir(), '.config', 'commit-critic');

/**
 * Resolve app configuration.
 */
export function resolveAppConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    configDir: overrides?.configDir ?? DEFAULT_CONFIG_DIR,
    jsonOutput: overrides?.jsonOutput ?? false,
    verbose: overrides?.verbose ?? getEnvBool('VERBOSE', false),
    noColor: overrides?.noColor ?? noColor(),
  };
}

/**
 * Get config directory path (expanded).
 */
export function getConfigDir(): string {
  return DEFAULT_CONFIG_DIR;
}
