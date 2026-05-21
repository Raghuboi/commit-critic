/**
 * Terminal progress bar with 8-level block characters.
 *
 * Respects NO_COLOR.
 */

import { noColor } from '../utils/env';

const BLOCKS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'];

export interface ProgressBar {
  update(current: number, total: number): void;
  stop(): void;
}

export function createProgressBar(label: string): ProgressBar {
  const useColor = !noColor();
  let currentMessage = '';

  function render(current: number, total: number) {
    const width = 30;
    const ratio = total > 0 ? current / total : 0;
    const filled = ratio * width;
    const fullBlocks = Math.floor(filled);
    const partial = Math.floor((filled - fullBlocks) * 8);
    const bar =
      BLOCKS[8].repeat(fullBlocks) +
      (fullBlocks < width ? BLOCKS[partial] : '') +
      ' '.repeat(width - fullBlocks - (partial > 0 ? 1 : 0));
    const pct = Math.round(ratio * 100);
    currentMessage = `${label} [${bar}] ${pct}% (${current}/${total})`;
    process.stderr.write(`\r${useColor ? '\x1b[36m' : ''}${currentMessage}${useColor ? '\x1b[0m' : ''}`);
  }

  return {
    update(current: number, total: number) {
      render(current, total);
    },
    stop() {
      process.stderr.write('\n');
    },
  };
}
