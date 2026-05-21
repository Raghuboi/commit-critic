/**
 * Environment variable helpers
 *
 * Provides typed access to environment variables with defaults.
 * Respects NO_COLOR.
 */

/**
 * Get environment variable as string.
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultValue;
  return val;
}

/**
 * Get environment variable as boolean.
 */
export function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val === '1' || val === 'true' || val === 'yes' || val === 'on';
}

/**
 * Get environment variable as number.
 */
export function getEnvNumber(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = Number(val);
  if (Number.isNaN(parsed)) return defaultValue;
  return parsed;
}

/**
 * Check if stdout is a TTY.
 */
export function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Check if colors should be disabled.
 */
export function noColor(): boolean {
  if (getEnvBool('NO_COLOR', false)) return true;
  if (getEnvBool('FORCE_COLOR', false)) return false;
  if (getEnvBool('CLICOLOR_FORCE', false)) return false;
  if (getEnv('CLICOLOR') === '0') return true;
  return !isTTY();
}
