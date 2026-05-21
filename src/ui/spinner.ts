/**
 * Animated spinner for long-running operations
 *
 * Unicode spinner frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
 * Inspired by Hermes Agent spinner patterns.
 */

/**
 * Create a spinner that shows animated status during analysis.
 */
export function createSpinner(_message: string): Spinner {
  // TODO: Implement
  return {
    start: () => {},
    stop: () => {},
    update: (_msg: string) => {},
  };
}

/**
 * Spinner interface.
 */
export interface Spinner {
  /** Start the spinner animation */
  start(): void;
  /** Stop the spinner animation */
  stop(): void;
  /** Update the spinner message */
  update(message: string): void;
}
