export function extractJson(text: string): unknown | null {
  const withoutThinking = stripThinking(text).trim();
  const codeFence = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeFence?.[1]) {
    const parsed = tryParseJson(codeFence[1]);
    if (parsed !== null) return parsed;
  }

  const direct = tryParseJson(withoutThinking);
  if (direct !== null) return direct;

  const objectText = extractFirstJsonObject(withoutThinking);
  return objectText ? tryParseJson(objectText) : null;
}

export function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text.trim());
  } catch {
    try {
      return JSON.parse(repairCommonJsonMistakes(text));
    } catch {
      return null;
    }
  }
}

function repairCommonJsonMistakes(text: string): string {
  return text
    .trim()
    .replace(/"\s*\n\s*"/g, '",\n"')
    .replace(/}\s*\n\s*{/g, '},\n{')
    .replace(/]\s*\n\s*"/g, '],\n"')
    .replace(/}\s*\n\s*"/g, '},\n"');
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
