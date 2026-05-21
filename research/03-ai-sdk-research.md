# AI SDK Provider Architecture Research Report

> **Date:** 2025-07-14
> **Scope:** AI SDK (Vercel) provider architecture for OpenAI-compatible and local models
> **Project:** AI Commit Message Critic (commit-critic)
> **AI SDK Version:** v6 (latest)

---

## 1. Executive Summary

The AI SDK v6 provides a unified interface for text/structured-output generation across dozens of providers. For our use case (commit message scoring, critique, and diff summarization), the recommended architecture is:

- **Provider Registry** (`createProviderRegistry`) as the central abstraction layer
- **OpenAI-compatible provider** (`@ai-sdk/openai-compatible`) for local models (vLLM, LM Studio, Ollama via OpenAI-compat endpoint)
- **Hybrid structured output strategy**: `Output.object()` with Zod schemas as primary, falling back to `generateText` + manual Zod parsing for weak/local models
- **`extractJsonMiddleware`** to handle local models that wrap JSON in markdown code fences
- **`customProvider` with `fallbackProvider`** for graceful degradation

---

## 2. AI SDK v6 Core APIs (Verified)

### 2.1 Text Generation

```ts
import { generateText, streamText } from 'ai';

const { text, usage, finishReason } = await generateText({
  model: provider('model-id'),
  prompt: 'Your prompt here',
  system: 'System instructions',
  maxRetries: 3,
  temperature: 0.7,
});
```

### 2.2 Structured Output (v6 API)

**IMPORTANT:** `generateObject` and `streamObject` are **deprecated** in v6. Use `generateText` + `Output.object()` instead:

```ts
import { generateText, Output } from 'ai';
import { z } from 'zod';

const { output } = await generateText({
  model: provider('model-id'),
  output: Output.object({
    schema: z.object({
      score: z.number().min(1).max(10),
      reasoning: z.string(),
      suggestions: z.array(z.string()),
    }),
  }),
  prompt: 'Analyze this commit message...',
});
// output is typed: { score: number; reasoning: string; suggestions: string[] }
```

**Output types available:**
- `Output.text()` - plain text (default)
- `Output.object({ schema })` - typed object with Zod/JSON schema validation
- `Output.array({ element })` - array of typed elements
- `Output.choice({ options })` - enum/choice selection
- `Output.json()` - unstructured JSON (no schema validation)

### 2.3 Error Handling for Structured Outputs

When structured output fails, the SDK throws `NoObjectGeneratedError`:

```ts
import { generateText, Output, NoObjectGeneratedError } from 'ai';

try {
  const result = await generateText({
    model: provider('model-id'),
    output: Output.object({ schema: mySchema }),
    prompt: '...',
  });
} catch (error) {
  if (NoObjectGeneratedError.isInstance(error)) {
    console.log('Raw text:', error.text);
    console.log('Usage:', error.usage);
    // Fallback: parse text manually or retry with different model
  }
}
```

---

## 3. Multi-Provider Setup

### 3.1 Provider Registry (Recommended)

The `createProviderRegistry` function is the canonical way to manage multiple providers:

```ts
import { createProviderRegistry, customProvider, wrapLanguageModel, defaultSettingsMiddleware, extractJsonMiddleware } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

// Create local providers
const lmStudio = createOpenAICompatible({
  name: 'lmstudio',
  baseURL: process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1',
  // No API key needed for local
});

const vllm = createOpenAICompatible({
  name: 'vllm',
  baseURL: process.env.VLLM_BASE_URL || 'http://localhost:8000/v1',
  apiKey: process.env.VLLM_API_KEY || '',
});

const ollamaCompat = createOpenAICompatible({
  name: 'ollama',
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
  apiKey: 'ollama', // Ollama OpenAI compat endpoint accepts any key
});

const openRouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Registry with all providers
export const aiRegistry = createProviderRegistry({
  openai,
  lmstudio: customProvider({
    languageModels: {
      // Wrap with JSON extraction middleware for local models
      'llama-3.3-70b': wrapLanguageModel({
        model: lmStudio('llama-3.3-70b'),
        middleware: [
          extractJsonMiddleware(),
          defaultSettingsMiddleware({
            settings: { temperature: 0.1, maxOutputTokens: 2048 },
          }),
        ],
      }),
    },
    fallbackProvider: lmStudio,
  }),
  vllm: customProvider({
    languageModels: {},
    fallbackProvider: vllm,
  }),
  ollama: customProvider({
    languageModels: {},
    fallbackProvider: ollamaCompat,
  }),
  openrouter: customProvider({
    languageModels: {},
    fallbackProvider: openRouter,
  }),
});

// Usage:
// aiRegistry.languageModel('openai:gpt-4.1')
// aiRegistry.languageModel('lmstudio:llama-3.3-70b')
// aiRegistry.languageModel('vllm:mistral-7b-instruct')
// aiRegistry.languageModel('ollama:llama3.2')
// aiRegistry.languageModel('openrouter:meta-llama/llama-3.3-70b-instruct')
```

### 3.2 Custom Provider with Fallback

For graceful fallback between providers:

```ts
import { customProvider, wrapLanguageModel, extractJsonMiddleware } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const localProvider = createOpenAICompatible({
  name: 'local',
  baseURL: process.env.AI_BASE_URL || 'http://localhost:1234/v1',
});

// Primary: local model with JSON extraction, fallback: OpenAI
export const criticProvider = customProvider({
  languageModels: {
    // Alias for convenience
    'critic': wrapLanguageModel({
      model: localProvider(process.env.AI_MODEL || 'llama-3.3-70b'),
      middleware: [
        extractJsonMiddleware(),
        defaultSettingsMiddleware({
          settings: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
      ],
    }),
  },
  fallbackProvider: openai, // Falls back to OpenAI if model not found
});
```

---

## 4. OpenAI-Compatible Base URL Support

### 4.1 Provider Matrix

| Provider | Package | Base URL | API Key | Structured Output |
|----------|---------|----------|---------|-------------------|
| OpenAI | `@ai-sdk/openai` | Built-in | `OPENAI_API_KEY` | Native (best) |
| OpenRouter | `@ai-sdk/openai-compatible` | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` | Model-dependent |
| vLLM | `@ai-sdk/openai-compatible` | `http://localhost:8000/v1` | Optional | Via `guided_json` / `response_format` |
| LM Studio | `@ai-sdk/openai-compatible` | `http://localhost:1234/v1` | None | Via `response_format` (GGUF uses llama.cpp grammar) |
| Ollama (OpenAI compat) | `@ai-sdk/openai-compatible` | `http://localhost:11434/v1` | `ollama` (any string) | Via `response_format` / `format` |
| Ollama (native) | `ollama-ai-provider-v2` | `http://localhost:11434` | None | Via `format` field |

### 4.2 vLLM Structured Output Support

vLLM supports structured outputs through two mechanisms:

1. **`response_format`** (OpenAI-compatible): `{"type": "json_schema", "json_schema": {...}}`
2. **`guided_json`** (vLLM-specific): Pass JSON schema via `extra_body`

vLLM uses **xgrammar** or **outlines** as backends for guided decoding. This means it can enforce JSON schemas at the token level for most models.

### 4.3 LM Studio Structured Output Support

LM Studio supports structured output via the OpenAI-compatible `response_format` parameter. It uses:
- **GGUF models**: llama.cpp grammar-based sampling (reliable schema enforcement)
- **MLX models**: Outlines library

**Caveat:** Models below 7B parameters may struggle with structured output regardless of enforcement.

### 4.4 Ollama Structured Output Support

Ollama supports structured outputs via:
1. **Native API**: `format: "json"` or `format: { JSON_SCHEMA }`
2. **OpenAI-compatible API**: `response_format: { type: "json_schema", json_schema: {...} }`

Ollama uses **llama.cpp GBNF grammars** under the hood. When you pass a JSON schema, Ollama converts it to a GBNF grammar and enforces it at the token level.

**Important:** Ollama does NOT validate the full response against the schema. If the model stops mid-JSON, the result may be incomplete. Always validate client-side with Zod.

---

## 5. Structured Output Strategy

### 5.1 Three Approaches Compared

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **Zod-first** (`Output.object()`) | Type-safe, auto-validation, clean API | May fail on weak/local models, throws `NoObjectGeneratedError` | Cloud models (OpenAI, Anthropic, strong local) |
| **Text-first** (`generateText` + manual parse) | Works with any model, full control | Manual JSON parsing, no auto-validation, error-prone | Weak local models, debugging |
| **Hybrid** (Zod-first with text fallback) | Best of both worlds, graceful degradation | More code, two code paths | **Our recommended approach** |

### 5.2 Recommended: Hybrid Strategy

```ts
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';

// Define Zod schemas for our use cases
const CommitCritiqueSchema = z.object({
  score: z.number().min(1).max(10).describe('Overall quality score 1-10'),
  summary: z.string().describe('One-sentence summary of the critique'),
  issues: z.array(
    z.object({
      category: z.enum(['type', 'scope', 'subject', 'body', 'convention']),
      severity: z.enum(['critical', 'warning', 'suggestion']),
      message: z.string(),
    })
  ).describe('List of issues found'),
  suggestions: z.array(z.string()).describe('Better commit message alternatives'),
});

type CommitCritique = z.infer<typeof CommitCritiqueSchema>;

/**
 * Hybrid structured output: tries Output.object() first,
 * falls back to text generation + manual parsing for weak models.
 */
async function critiqueCommit(
  model: any,
  commitMessage: string,
  diff: string,
  options: { strictMode?: boolean } = {}
): Promise<CommitCritique> {
  const { strictMode = false } = options;

  const systemPrompt = `You are a commit message critic. Analyze commit messages against Conventional Commits spec (https://www.conventionalcommits.org/).
  Score from 1-10. Provide specific, actionable feedback.`;

  const userPrompt = `Critique this commit message:
  
  Message: "${commitMessage}"
  
  ${diff ? `Diff:\n\`\`\`diff\n${diff}\n\`\`\`` : ''}
  
  Return a JSON object with: score (1-10), summary, issues (array of {category, severity, message}), and suggestions (array of strings).`;

  // Try structured output first
  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      output: Output.object({
        schema: CommitCritiqueSchema,
        name: 'commit-critique',
        description: 'Critique of a git commit message',
      }),
      maxRetries: strictMode ? 0 : 2,
      temperature: 0.1,
    });
    return result.output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      if (strictMode) {
        throw new Error(`Structured output failed in strict mode: ${error.cause}`);
      }

      // Fallback: generate text and parse manually
      const textResult = await generateText({
        model,
        system: systemPrompt + '\n\nRespond with ONLY valid JSON. No markdown, no explanation.',
        prompt: userPrompt,
        maxRetries: 1,
        temperature: 0.1,
      });

      // Strip markdown code fences if present
      let rawText = textResult.text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      try {
        const parsed = JSON.parse(rawText);
        return CommitCritiqueSchema.parse(parsed);
      } catch (parseError) {
        throw new Error(
          `Failed to parse commit critique. Model output: ${rawText.slice(0, 200)}`
        );
      }
    }
    throw error;
  }
}
```

### 5.3 Using `extractJsonMiddleware` for Local Models

Many local models wrap JSON in markdown code fences even when asked for raw JSON. The `extractJsonMiddleware` strips these automatically:

```ts
import { wrapLanguageModel, extractJsonMiddleware, generateText, Output } from 'ai';
import { z } from 'zod';

// Wrap the model with JSON extraction middleware
const modelWithJsonExtraction = wrapLanguageModel({
  model: localProvider('llama-3.3-70b'),
  middleware: extractJsonMiddleware(),
});

// Now Output.object() works even if the model wraps JSON in ```json blocks
const { output } = await generateText({
  model: modelWithJsonExtraction,
  output: Output.object({ schema: CommitCritiqueSchema }),
  prompt: '...',
});
```

---

## 6. Fallback Strategy for Weak/Local Models

### 6.1 Model Capability Tiers

| Tier | Models | Structured Output | Strategy |
|------|--------|-------------------|----------|
| **Tier 1 (Strong)** | GPT-4.1, Claude Sonnet 4.5, Gemini 2.5 Pro | Native, reliable | `Output.object()` directly |
| **Tier 2 (Good)** | Llama 3.3 70B, Qwen 2.5 72B (via vLLM/LM Studio) | Grammar-enforced | `Output.object()` + `extractJsonMiddleware` |
| **Tier 3 (Weak)** | Models < 7B, quantized models | Unreliable | Text-first with manual Zod validation |
| **Tier 4 (Minimal)** | Very small models (< 3B) | Often fails | Simplified prompts, `Output.json()` + manual parse |

### 6.2 Provider Configuration with Capability Detection

```ts
// config/ai-providers.ts

export interface ProviderConfig {
  name: string;
  provider: any;
  modelId: string;
  capabilities: {
    structuredOutput: boolean;  // Whether model reliably supports Output.object()
    jsonExtraction: boolean;    // Whether extractJsonMiddleware is needed
    maxTokens: number;
  };
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  'openai:gpt-4.1': {
    name: 'OpenAI GPT-4.1',
    provider: 'openai',
    modelId: 'gpt-4.1',
    capabilities: {
      structuredOutput: true,
      jsonExtraction: false,
      maxTokens: 4096,
    },
  },
  'lmstudio:llama-3.3-70b': {
    name: 'LM Studio Llama 3.3 70B',
    provider: 'lmstudio',
    modelId: 'llama-3.3-70b',
    capabilities: {
      structuredOutput: true,
      jsonExtraction: true,  // Local models often wrap in code fences
      maxTokens: 4096,
    },
  },
  'ollama:llama3.2': {
    name: 'Ollama Llama 3.2',
    provider: 'ollama',
    modelId: 'llama3.2',
    capabilities: {
      structuredOutput: false,  // Smaller model, less reliable
      jsonExtraction: true,
      maxTokens: 2048,
    },
  },
};

/**
 * Get a configured model with appropriate middleware
 */
export function getconfiguredModel(modelKey: string) {
  const config = PROVIDER_CONFIGS[modelKey];
  if (!config) {
    throw new Error(`Unknown model: ${modelKey}`);
  }

  const model = aiRegistry.languageModel(`${config.provider}:${config.modelId}`);

  const middlewares = [];
  if (config.capabilities.jsonExtraction) {
    middlewares.push(extractJsonMiddleware());
  }
  middlewares.push(
    defaultSettingsMiddleware({
      settings: {
        temperature: 0.1,
        maxOutputTokens: config.capabilities.maxTokens,
      },
    })
  );

  return middlewares.length > 0
    ? wrapLanguageModel({ model, middleware: middlewares })
    : model;
}
```

### 6.3 Retry and Fallback Logic

```ts
/**
 * Execute with model fallback chain.
 * Tries primary model first, falls back through the chain on failure.
 */
async function executeWithFallback<T>(
  task: (model: any) => Promise<T>,
  modelChain: string[],
  fallbackOnErrors: (typeof Error)[] = [NoObjectGeneratedError, Error]
): Promise<T> {
  const errors: Error[] = [];

  for (const modelKey of modelChain) {
    try {
      const model = getconfiguredModel(modelKey);
      return await task(model);
    } catch (error) {
      const isFallbackError = fallbackOnErrors.some(
        (ErrClass) => error instanceof ErrClass
      );
      if (isFallbackError) {
        errors.push(error);
        console.warn(`Model ${modelKey} failed, trying next...`, error.message);
        continue;
      }
      throw error; // Non-recoverable error
    }
  }

  throw new Error(
    `All models failed: ${modelChain.join(', ')}\n${errors.map(e => e.message).join('\n')}`
  );
}

// Usage:
const result = await executeWithFallback(
  (model) => critiqueCommit(model, message, diff),
  ['lmstudio:llama-3.3-70b', 'openai:gpt-4.1', 'openrouter:meta-llama/llama-3.3-70b-instruct']
);
```

---

## 7. Environment Variable Design

```bash
# .env.example

# === Primary Provider ===
# Provider to use: openai | openrouter | lmstudio | vllm | ollama
AI_PROVIDER=openai

# Model ID within the selected provider
AI_MODEL=gpt-4.1

# Strict mode: if true, fail fast on structured output errors instead of falling back
AI_STRICT_MODE=false

# === OpenAI ===
OPENAI_API_KEY=sk-...

# === OpenRouter ===
OPENROUTER_API_KEY=sk-or-...

# === LM Studio ===
LM_STUDIO_BASE_URL=http://localhost:1234/v1
LM_STUDIO_MODEL=llama-3.3-70b

# === vLLM ===
VLLM_BASE_URL=http://localhost:8000/v1
VLLM_API_KEY=
VLLM_MODEL=mistral-7b-instruct

# === Ollama ===
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2

# === Fallback Chain ===
# Comma-separated list of provider:model fallback chain
# Example: AI_FALLBACK_CHAIN=lmstudio:llama-3.3-70b,openai:gpt-4.1
AI_FALLBACK_CHAIN=

# === Generation Settings ===
AI_TEMPERATURE=0.1
AI_MAX_TOKENS=4096
AI_MAX_RETRIES=2
```

### 7.1 Config Resolution Pattern

```ts
// config/ai-config.ts

interface AIConfig {
  provider: string;
  modelId: string;
  baseURL?: string;
  apiKey?: string;
  strictMode: boolean;
  temperature: number;
  maxTokens: number;
  maxRetries: number;
  fallbackChain: string[];
}

export function loadAIConfig(): AIConfig {
  const provider = process.env.AI_PROVIDER || 'openai';
  const modelId = process.env.AI_MODEL || 'gpt-4.1';

  let baseURL: string | undefined;
  let apiKey: string | undefined;

  switch (provider) {
    case 'openai':
      apiKey = process.env.OPENAI_API_KEY;
      break;
    case 'openrouter':
      baseURL = 'https://openrouter.ai/api/v1';
      apiKey = process.env.OPENROUTER_API_KEY;
      break;
    case 'lmstudio':
      baseURL = process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1';
      break;
    case 'vllm':
      baseURL = process.env.VLLM_BASE_URL || 'http://localhost:8000/v1';
      apiKey = process.env.VLLM_API_KEY || '';
      break;
    case 'ollama':
      baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
      apiKey = 'ollama';
      modelId = process.env.OLLAMA_MODEL || modelId;
      break;
  }

  return {
    provider,
    modelId,
    baseURL,
    apiKey,
    strictMode: process.env.AI_STRICT_MODE === 'true',
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.1'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4096'),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '2'),
    fallbackChain: process.env.AI_FALLBACK_CHAIN
      ? process.env.AI_FALLBACK_CHAIN.split(',').map(s => s.trim())
      : [],
  };
}
```

---

## 8. Complete Architecture Diagram

```
                    +-------------------+
                    |   AI Config       |
                    | (env vars)        |
                    +--------+----------+
                             |
                    +--------v----------+
                    |  Provider Factory |
                    |  createProvider   |
                    +--------+----------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v----+ +------v------+ +-----v------+
     |   OpenAI    | | OpenAI-Comp | |  Ollama    |
     |  Provider   | |  Provider   | |  Provider  |
     +-----+------+ +------+------+ +-----+------+
           |              |               |
           |    +---------v--------+      |
           |    |  Local Models    |      |
           |    |  vLLM / LM Studio|     |
           |    |  / Ollama        |     |
           |    +------------------+      |
              |              |            |
     +--------v--------------v------------v--------+
     |        Provider Registry                   |
     |  createProviderRegistry({                  |
     |    openai, lmstudio, vllm, ollama, ...     |
     |  })                                        |
     +------------------+-------------------------+
                        |
              +---------v----------+
              |  Model Wrapper     |
              |  + middlewares:    |
              |  - extractJson     |
              |  - defaultSettings |
              +----------+---------+
                         |
              +----------v----------+
              |  Hybrid Output      |
              |  Strategy           |
              |                     |
              |  1. Output.object() |
              |  2. On failure:     |
              |     generateText()  |
              |     + Zod.parse()   |
              +----------+----------+
                         |
              +----------v----------+
              |  Typed Result       |
              |  (z.infer<Schema>)  |
              +---------------------+
```

---

## 9. Key Recommendations

1. **Use `createProviderRegistry`** as the single source of truth for all model access. This gives you `provider:model` string IDs that can be configured via environment variables.

2. **Always wrap local models with `extractJsonMiddleware()`**. Local models (especially via LM Studio and Ollama) frequently wrap JSON in markdown code fences, which breaks `Output.object()` parsing.

3. **Use the hybrid structured output strategy**. Try `Output.object()` first for type safety, then fall back to `generateText()` + manual Zod parsing. This handles weak models gracefully.

4. **Set `temperature: 0.1`** for all commit-critic tasks. Deterministic output is critical for structured JSON responses.

5. **Use `maxOutputTokens`** to prevent runaway generation, especially with local models that may not stop cleanly.

6. **Define Zod schemas with `.describe()`** on each field. The AI SDK passes these descriptions to the LLM as part of the schema, improving output quality.

7. **For Ollama specifically**, prefer the OpenAI-compatible endpoint (`http://localhost:11434/v1`) over the native API when using `@ai-sdk/openai-compatible`. This gives you a unified interface across all local providers.

8. **Handle `NoObjectGeneratedError` explicitly**. This is the AI SDK's way of saying "the model could not produce valid structured output." Your fallback logic should catch this and either retry with text mode or switch to a stronger model.

---

## 10. Source Citations

| Source | URL | Accessed |
|--------|-----|----------|
| AI SDK v6 Docs (Home) | https://sdk.vercel.ai/docs | 2025-07-14 |
| AI SDK Core: Output (Structured Outputs) | https://sdk.vercel.ai/docs/reference/ai-sdk-core/output | 2025-07-14 |
| AI SDK Core: generateText | https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-text | 2025-07-14 |
| AI SDK Core: createProviderRegistry | https://sdk.vercel.ai/docs/reference/ai-sdk-core/provider-registry | 2025-07-14 |
| AI SDK Core: customProvider | https://sdk.vercel.ai/docs/reference/ai-sdk-core/custom-provider | 2025-07-14 |
| AI SDK Core: Provider & Model Management | https://sdk.vercel.ai/docs/ai-sdk-core/provider-management | 2025-07-14 |
| AI SDK Core: Language Model Middleware | https://sdk.vercel.ai/docs/ai-sdk-core/middleware | 2025-07-14 |
| AI SDK: OpenAI Compatible Providers | https://sdk.vercel.ai/providers/openai-compatible-providers | 2025-07-14 |
| AI SDK: LM Studio Provider | https://sdk.vercel.ai/providers/openai-compatible-providers/lmstudio | 2025-07-14 |
| AI SDK: Ollama Provider (Community) | https://sdk.vercel.ai/providers/community-providers/ollama | 2025-07-14 |
| AI SDK: OpenRouter Provider (Community) | https://sdk.vercel.ai/providers/community-providers/openrouter | 2025-07-14 |
| AI SDK v6 Migration Guide | https://sdk.vercel.ai/docs/migration-guides/migration-guide-6-0 | 2025-07-14 |
| AI SDK: zodSchema | https://sdk.vercel.ai/docs/reference/ai-sdk-core/zod-schema | 2025-07-14 |
| AI SDK: Tool Calling | https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling | 2025-07-14 |
| LM Studio: Structured Output | https://lmstudio.ai/docs/developer/openai-compat/structured-output | 2025-07-14 |
| Ollama: Structured Outputs | https://docs.ollama.com/capabilities/structured-outputs | 2025-07-14 |
| Ollama: Structured Outputs (GitHub) | https://github.com/ollama/ollama/blob/main/docs/capabilities/structured-outputs.mdx | 2025-07-14 |
| vLLM: Structured Outputs | https://docs.vllm.ai/en/stable/features/structured_outputs/ | 2025-07-14 |
| Ollama Structured Outputs Deep Dive | https://blog.danielclayton.co.uk/posts/ollama-structured-outputs/ | 2025-07-14 |
