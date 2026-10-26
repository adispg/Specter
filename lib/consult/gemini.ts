import { GoogleGenAI, Type } from "@google/genai";
import type { ChatTurn, SystemBlocks } from "@/lib/personas/prompt";
import { systemText } from "@/lib/personas/prompt";
import { LlmError, type Completion, type CompletionRequest, type LlmClient } from "./llm";

/**
 * Gemini client implementing the same LlmClient interface as AnthropicClient.
 * Nothing outside this file knows which SDK is in use.
 *
 * Uses @google/genai. The predecessor, @google/generative-ai, is deprecated and
 * exposes no way to cap the model's internal reasoning. Gemini 3.x thinks before
 * it writes, and on a measured reply that was roughly 14 seconds to emit 163
 * output tokens. thinkingConfig is the lever that fixes it, and only this SDK
 * has it.
 *
 * Note that Google retires model ids: gemini-2.0-flash, a previous default here,
 * has been shut down and returns 404, so check the current model list before
 * pinning one.
 *
 * Gemini has no prompt caching equivalent to Anthropic's, so SystemBlocks.cached
 * and .dynamic are concatenated into a single system instruction.
 */

/**
 * Tried in order when GEMINI_MODEL is not set. Flash capacity is shared and a
 * popular model returns 503 "high demand" under load, so a single hardcoded
 * model makes the whole app fail for reasons nothing here controls.
 */
const DEFAULT_MODEL_CHAIN = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"];

/**
 * 0 disables thinking. The reply is a fixed JSON contract filled from a long
 * system prompt, not a reasoning problem, so the deliberation was paid for and
 * thrown away. Raise this only if reply quality measurably drops.
 */
const THINKING_BUDGET = 0;

/** Native JSON enforcement: Flash otherwise wraps JSON in markdown or adds prose. */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mode: { type: Type.STRING },
    line: { type: Type.STRING },
    followup: { type: Type.STRING },
    matter: { type: Type.STRING },
    read: { type: Type.STRING },
    play: { type: Type.ARRAY, items: { type: Type.STRING } },
    avoid: { type: Type.STRING },
    principle: { type: Type.STRING },
    intent: { type: Type.STRING },
    stakes: { type: Type.STRING },
    hours: { type: Type.NUMBER },
  },
  required: ["mode", "line", "followup", "matter", "read", "play", "avoid", "principle", "intent", "stakes", "hours"],
};

export class GeminiClient implements LlmClient {
  private readonly client: GoogleGenAI;
  private readonly chain: string[];
  readonly model: string;

  constructor(
    private readonly apiKey: string,
    model?: string,
    private readonly timeoutMs = 45_000,
  ) {
    if (!apiKey) throw new LlmError("GEMINI_API_KEY is not set", "not_configured");
    this.client = new GoogleGenAI({ apiKey });
    // An explicit GEMINI_MODEL pins one model and disables the fallback.
    this.chain = model ? [model] : [...DEFAULT_MODEL_CHAIN];
    this.model = this.chain[0] ?? DEFAULT_MODEL_CHAIN[0]!;
  }

  async complete(req: CompletionRequest): Promise<Completion> {
    let lastErr: unknown;
    for (const model of this.chain) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await this.once(req, model);
        } catch (e) {
          lastErr = e;
          const retryable = e instanceof LlmError && (e.code === "overloaded" || (e.status ?? 0) >= 500);
          // A bad key or a malformed request fails the same way on every model.
          if (!retryable) throw e;
          if (attempt === 0) await new Promise((r) => setTimeout(r, 600 + Math.random() * 500));
        }
      }
      console.warn(`[gemini] ${model} unavailable, trying next model in the chain`);
    }
    throw lastErr;
  }

  private async once(req: CompletionRequest, modelId: string): Promise<Completion> {
    const systemInstruction =
      typeof req.system === "string" ? req.system : systemText(req.system as SystemBlocks);

    const turns = req.messages;
    const lastTurn = turns[turns.length - 1];
    if (!lastTurn || lastTurn.role !== "user") {
      throw new LlmError("Last message must be from the user", "upstream");
    }

    // generateContent takes the whole thread, the final user turn included,
    // rather than the old split between history and a separate send.
    const contents = turns.map((t: ChatTurn) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }],
    }));

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);

    try {
      const res = await this.client.models.generateContent({
        model: modelId,
        contents,
        config: {
          systemInstruction,
          // Gemini 3.x spends output budget on internal reasoning before emitting
          // the answer, so a 1000 cap truncated the JSON mid-object and every reply
          // failed schema validation as "garbled".
          maxOutputTokens: req.maxTokens ?? 4000,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: THINKING_BUDGET },
          abortSignal: ctl.signal,
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        },
      });

      const text = res.text ?? "";
      const usage = res.usageMetadata;

      return {
        text,
        usage: {
          inputTokens: usage?.promptTokenCount ?? null,
          outputTokens: usage?.candidatesTokenCount ?? null,
          cacheReadTokens: usage?.cachedContentTokenCount ?? null,
        },
      };
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new LlmError("Gemini API timed out", "timeout");
      const msg = (e as Error).message ?? "";
      // The SDK reports HTTP status either on the error or as "[404] ..." in the
      // message. Read it properly: an older check was `msg.includes("5")`, which
      // matched almost any message and reported a dead model as a 5xx overload.
      const status =
        (e as { status?: number }).status ?? Number(msg.match(/\[(\d{3})\]/)?.[1] ?? 0);
      const lower = msg.toLowerCase();
      if (status === 429 || lower.includes("quota") || lower.includes("rate limit")) {
        throw new LlmError(`Gemini rate limited: ${msg}`, "overloaded", 429);
      }
      if (status === 404 || lower.includes("is not found for api version")) {
        throw new LlmError(
          `Gemini model "${modelId}" is not available. Set GEMINI_MODEL to a current model. (${msg})`,
          "not_configured",
          404,
        );
      }
      if (status === 400 || status === 401 || status === 403) {
        throw new LlmError(`Gemini rejected the request (${status}): ${msg}`, "not_configured", status);
      }
      if (status >= 500) throw new LlmError(`Gemini upstream error: ${msg}`, "upstream", status);
      throw new LlmError(`Gemini error: ${msg}`, "upstream");
    } finally {
      clearTimeout(timer);
    }
  }
}
