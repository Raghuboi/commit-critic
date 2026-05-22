import { stripThinking } from './json-helper';

export function formatStructuredCommitMessage(type: string, scope: string | undefined, description: string, body?: string): string {
  const cleanType = sanitizeCommitType(type);
  const cleanScope = sanitizeCommitScope(scope);
  const scopePart = cleanScope ? `(${cleanScope})` : '';
  const subjectPrefix = `${cleanType}${scopePart}:`;
  const cleanDescription = sanitizeCommitDescription(description, subjectPrefix);
  const subject = `${subjectPrefix} ${cleanDescription || 'update staged changes'}`;
  const cleanBody = sanitizeCommitBody(body, subject);
  return cleanBody ? `${subject}\n\n${cleanBody}` : subject;
}

function sanitizeCommitType(type: string): string {
  const normalized = type.trim().toLowerCase().replace(/[^a-z]/g, '');
  return normalized || 'chore';
}

function sanitizeCommitScope(scope: string | undefined): string | undefined {
  const normalized = scope?.trim().replace(/^\(/, '').replace(/\)$/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
  return normalized || undefined;
}

function sanitizeCommitDescription(description: string, subjectPrefix: string): string {
  let value = cleanCommitMessage(description).split('\n')[0]?.trim() ?? '';
  value = stripSubjectPrefix(value, subjectPrefix).replace(/^[-–—\s]+/, '').trim();
  return value.replace(/\.$/, '').trim();
}

function sanitizeCommitBody(body: string | undefined, subject: string): string {
  if (!body) return '';
  const subjectNormalized = normalizeCommitLine(subject);
  const lines = cleanCommitMessage(body)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd());

  while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
  while (lines.length > 0 && normalizeCommitLine(lines[0]!) === subjectNormalized) {
    lines.shift();
    while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
  }

  const value = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return normalizeCommitLine(value) === subjectNormalized ? '' : value;
}

function stripSubjectPrefix(value: string, subjectPrefix: string): string {
  if (value.toLowerCase().startsWith(subjectPrefix.toLowerCase())) {
    return value.slice(subjectPrefix.length).trim();
  }
  return value.replace(/^\w+(?:\([^)]+\))?!?:\s*/, '').trim();
}

function normalizeCommitLine(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function cleanCommitMessage(text: string): string {
  let value = stripThinking(text).trim();
  const fence = value.match(/```(?:[a-zA-Z]+)?\s*([\s\S]*?)```/);
  if (fence?.[1]) value = fence[1].trim();

  value = value
    .replace(/^commit message:\s*/i, '')
    .replace(/^suggested commit message:\s*/i, '')
    .trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }

  return dedupeRepeatedSubject(value);
}

function dedupeRepeatedSubject(value: string): string {
  const lines = value.replace(/\r\n/g, '\n').split('\n').map(line => line.trimEnd());
  const firstIndex = lines.findIndex(line => line.trim().length > 0);
  if (firstIndex === -1) return '';

  const subject = normalizeCommitLine(lines[firstIndex]!);
  const deduped = lines.filter((line, index) => index === firstIndex || normalizeCommitLine(line) !== subject);
  return deduped.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
