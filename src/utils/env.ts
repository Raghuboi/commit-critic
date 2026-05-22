/** Environment variable helpers. */

export function getEnv(key: string): string | undefined;
export function getEnv(key: string, defaultValue: string): string;
export function getEnv(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key];
  return value === undefined || value === '' ? defaultValue : value;
}

export function getEnvBool(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (value === undefined || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

export function noColor(): boolean {
  if (getEnvBool('FORCE_COLOR') || getEnvBool('CLICOLOR_FORCE')) return false;
  if (getEnvBool('NO_COLOR') || getEnv('CLICOLOR') === '0') return true;
  return !isTTY();
}
