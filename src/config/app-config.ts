/**
 * App config resolution
 *
 * Handles:
 * - Config directory location (~/.config/commit-critic)
 * - JSON output flag
 * - Verbose mode
 * - NO_COLOR support
 */

import type { AppConfig } from '../types/config';

/**
 * Default config directory.
 */
const DEFAULT_CONFIG_DIR = '~/.config/commit-critic';

/**
 * Resolve app configuration.
 */
export function resolveAppConfig(): AppConfig {
  // TODO: Implement
  return {
    configDir: DEFAULT_CONFIG_DIR,
    jsonOutput: false,
    verbose: false,
    noColor: false,
  };
}

/**
 * Get config directory path (expanded).
 */
export function getConfigDir(): string {
  // TODO: Implement — expand ~ to home directory
  return DEFAULT_CONFIG_DIR;
}
