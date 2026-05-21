/**
 * Terminal spinner with platform-aware characters.
 *
 * Respects NO_COLOR.
 */

import { noColor } from '../utils/env';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export interface Spinner {
  start(): void;
  stop(): void;
  update(message: string): void;
}

export function createSpinner(message: string): Spinner {
  let frame = 0;
  let interval: ReturnType<typeof setInterval> | null = null;
  let currentMessage = message;
  const useColor = !noColor();

  return {
    start() {
      if (interval) return;
      interval = setInterval(() => {
        const f = FRAMES[frame++ % FRAMES.length];
        process.stderr.write(`\r${useColor ? '\x1b[36m' : ''}${f}${useColor ? '\x1b[0m' : ''} ${currentMessage}`);
      }, 80);
    },
    stop() {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
      process.stderr.write('\r' + ' '.repeat(currentMessage.length + 4) + '\r');
    },
    update(message: string) {
      currentMessage = message;
    },
  };
}
