import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { ChatTurn, SystemBlocks } from "@/lib/personas/prompt";
import { systemText } from "@/lib/personas/prompt";
import { LlmError, type Completion, type CompletionRequest, type LlmClient } from "./llm";

/**
 * Gemini client implementing the same LlmClient interface as AnthropicClient.
 * Uses gemini-3.8-flash by default. Override with GEMINI_MODEL. Note that Google
 * retires model ids: gemini-2.0-flash, the previous default here, has been shut
 * down and returns 404, so check the current model list before pinning one.
 *
 * Note: Gemini does not support prompt caching the same way Anthropic does, so
 * SystemBlocks.cached and .dynamic are concatenated into a single system prompt.
 */
/**
 * Tried in order when GEMINI_MODEL is not set. Flash capacity is shared and a
 * popular model returns 503 "high demand" under load, so a single hardcoded
 * model makes the whole app fail for reasons nothing here controls.
 */
const DEFAULT_MODEL_CHAIN = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

export class GeminiClient implements LlmClient {
  private readonly client: GoogleGenerativeAI;
  private readonly chain: string[];
  readonly model: string;

  constructor(
    private readonly apiKey: string,
    model?: string,
    private readonly timeoutMs = 45_000,
  ) {
    if (!apiKey) throw new LlmError("GEMINI_API_KEY is not set", "not_configured");
    this.client = new GoogleGenerativeAI(apiKey);
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

    // Native JSON schema enforcement: Gemini Flash sometimes wraps JSON in markdown
    // or adds prose before/after. responseMimeType + responseSchema forces pure JSON out.
    // Type assertions are required because the SDK's Schema union is discriminated on
    // the literal SchemaType enum value, not the general SchemaType type.
    const responseSchema = {
      type: SchemaType.OBJECT as const,
      properties: {
        mode: { type: SchemaType.STRING as const },
        line: { type: SchemaType.STRING as const },
        followup: { type: SchemaType.STRING as const },
        matter: { type: SchemaType.STRING as const },
        read: { type: SchemaType.STRING as const },
        play: { type: SchemaType.ARRAY as const, items: { type: SchemaType.STRING as const } },
        avoid: { type: SchemaType.STRING as const },
        principle: { type: SchemaType.STRING as const },
        intent: { type: SchemaType.STRING as const },
        stakes: { type: SchemaType.STRING as const },
        hours: { type: SchemaType.NUMBER as const },
      },
      required: ["mode", "line", "followup", "matter", "read", "play", "avoid", "principle", "intent", "stakes", "hours"],
    };

    const model = this.client.getGenerativeModel({
      model: modelId,
      systemInstruction,
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 1000,
        responseMimeType: "application/json",
        responseSchema,
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
      // The SDK reports HTTP status either on the error or as "[404] ..." in the
      // message. Read it properly: the old check was `msg.includes("5")`, which
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
