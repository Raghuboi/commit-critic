export const CONVENTIONAL_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
] as const;

export type ConventionalType = typeof CONVENTIONAL_TYPES[number];

const COMMIT_TYPE_DESCRIPTIONS: Record<ConventionalType, string> = {
  feat: 'A new feature',
  fix: 'A bug fix',
  docs: 'Documentation only changes',
  style: 'Code style changes',
  refactor: 'Code refactoring',
  perf: 'Performance improvements',
  test: 'Adding or updating tests',
  build: 'Build system changes',
  ci: 'CI/CD changes',
  chore: 'Other changes',
  revert: 'Revert a commit',
};

export const CONVENTIONAL_TYPES_SET = new Set<string>(CONVENTIONAL_TYPES);

export const COMMIT_TYPE_OPTIONS = CONVENTIONAL_TYPES.map((type) => ({
  name: type,
  value: type,
  description: COMMIT_TYPE_DESCRIPTIONS[type],
}));
