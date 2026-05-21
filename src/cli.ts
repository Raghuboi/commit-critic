#!/usr/bin/env bun
/**
 * Entry point: clipanion CLI setup
 *
 * Parses arguments, routes to commands, handles global flags (--json, --verbose, --version, --help).
 * Implements semantic exit codes and error hints following Steel CLI patterns.
 *
 * Usage:
 *   commit-critic analyze [options]
 *   commit-critic write [options]
 *   commit-critic doctor [options]
 */

import { Cli, Builtins } from 'clipanion';
import { AnalyzeCommand } from './commands/analyze';
import { WriteCommand } from './commands/write';
import { DoctorCommand } from './commands/doctor';

const cli = new Cli({
  binaryName: 'commit-critic',
  binaryLabel: 'commit-critic',
  binaryVersion: '0.1.0',
});

cli.register(AnalyzeCommand);
cli.register(WriteCommand);
cli.register(DoctorCommand);
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

// Exit with semantic code
const exitCode = await cli.runExit(process.argv.slice(2));
if (typeof exitCode === 'number') {
  process.exit(exitCode);
}
