import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatTurn, SystemBlocks } from "@/lib/personas/prompt";
import { systemText } from "@/lib/personas/prompt";
import { LlmError, type Completion, type CompletionRequest, type LlmClient } from "./llm";

/**
 * Gemini client implementing the same LlmClient interface as AnthropicClient.
 * Uses gemini-2.0-flash by default (free tier: 1500 req/day, 1M tokens/min).
 * Falls back to gemini-1.5-flash if the model env var is set to that.
 *
 * Note: Gemini does not support prompt caching the same way Anthropic does, so
 * SystemBlocks.cached and .dynamic are concatenated into a single system prompt.
 */
export class GeminiClient implements LlmClient {
  private readonly client: GoogleGenerativeAI;

  constructor(
    private readonly apiKey: string,
    readonly model: string = "gemini-2.0-flash",
    private readonly timeoutMs = 45_000,
  ) {
    if (!apiKey) throw new LlmError("GEMINI_API_KEY is not set", "not_configured");
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async complete(req: CompletionRequest): Promise<Completion> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.once(req);
      } catch (e) {
        lastErr = e;
        const retryable = e instanceof LlmError && (e.code === "overloaded" || (e.status ?? 0) >= 500);
        if (!retryable || attempt === 1) throw e;
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
      }
    }
    throw lastErr;
  }

  private async once(req: CompletionRequest): Promise<Completion> {
    const systemInstruction =
      typeof req.system === "string" ? req.system : systemText(req.system as SystemBlocks);

    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction,
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 1000,
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      },
    });

    // Convert ChatTurn[] to Gemini history format.
    // Gemini requires history to not include the last user message (that goes in sendMessage).
    const turns = req.messages;
    const lastTurn = turns[turns.length - 1];
    if (!lastTurn || lastTurn.role !== "user") {
      throw new LlmError("Last message must be from the user", "upstream");
    }

    const history = turns.slice(0, -1).map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }],
    }));

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);

    try {
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastTurn.content);
      const response = result.response;

      const text = response.text();
      const usage = response.usageMetadata;

      return {
        text,
        usage: {
          inputTokens: usage?.promptTokenCount ?? null,
          outputTokens: usage?.candidatesTokenCount ?? null,
          cacheReadTokens: null,
        },
      };
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new LlmError("Gemini API timed out", "timeout");
      const msg = (e as Error).message ?? "";
      if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
        throw new LlmError(`Gemini rate limited: ${msg}`, "overloaded", 429);
      }
      if (msg.includes("5")) {
        throw new LlmError(`Gemini upstream error: ${msg}`, "upstream", 500);
      }
      throw new LlmError(`Gemini error: ${msg}`, "upstream");
    } finally {
      clearTimeout(timer);
    }
  }
}
