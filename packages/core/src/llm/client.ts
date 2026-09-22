export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMClientOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormatJson?: boolean;
}

export interface LLMProvider {
  name: string;
  complete(messages: LLMMessage[], options?: LLMClientOptions): Promise<string>;
}

/**
 * Strips markdown code blocks and cleans JSON strings returned by LLMs.
 */
export function cleanJsonOutput(text: string): string {
  let cleaned = text.trim();
  // Remove markdown code fences ```json ... ``` or ``` ... ```
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```$/, "");
  }
  // Remove any trailing or leading whitespace
  return cleaned.trim();
}

/**
 * Safely parses JSON with auto-repair heuristics.
 */
export function safeParseJson<T>(text: string, fallback: T): T {
  const cleaned = cleanJsonOutput(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // Attempt to locate first { or [ and last } or ]
    const firstBrace = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");
    const lastBrace = cleaned.lastIndexOf("}");
    const lastBracket = cleaned.lastIndexOf("]");

    const start = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket) ? firstBrace : firstBracket;
    const end = lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket) ? lastBrace : lastBracket;

    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        // Fallback below
      }
    }
    return fallback;
  }
}
