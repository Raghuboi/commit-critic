import { safeParseJSON } from '@ai-sdk/provider-utils';
import { jsonrepair } from 'jsonrepair';

export async function extractJson(text: string): Promise<unknown | null> {
  const withoutThinking = stripThinking(text).trim();
  if (!withoutThinking) return null;

  const candidates = jsonCandidates(withoutThinking);
  for (const candidate of candidates) {
    const parsed = await parsePossiblyRepairedJson(candidate);
    if (parsed !== null) return parsed;
  }

  return null;
}

export function stripThinking(text: string): string {
  return text
    .replace(/<think\s*>[\s\S]*?<\/think\s*>/gi, '')
    .replace(/<think\s*>[\s\S]*$/gi, '')
    .replace(/<\/think\s*>/gi, '')
    .trim();
}

function jsonCandidates(text: string): string[] {
  const candidates: string[] = [];
  const codeFence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeFence?.[1]) candidates.push(codeFence[1]);

  candidates.push(text);

  const objectText = extractFirstJsonObject(text);
  if (objectText) candidates.push(objectText);

  return [...new Set(candidates.map(candidate => candidate.trim()).filter(Boolean))];
}

async function parsePossiblyRepairedJson(text: string): Promise<unknown | null> {
  const direct = await safeParseJSON({ text });
  if (direct.success && isJsonContainer(direct.value)) return direct.value;

  try {
    const repaired = jsonrepair(text);
    const repairedResult = await safeParseJSON({ text: repaired });
    return repairedResult.success && isJsonContainer(repairedResult.value) ? repairedResult.value : null;
  } catch {
    return null;
  }
}

function isJsonContainer(value: unknown): boolean {
  return value !== null && typeof value === 'object';
}

function extractFirstJsonObject(text: string): string | null {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}
