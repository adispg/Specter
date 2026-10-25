import type { ChatTurn, SystemBlocks } from "@/lib/personas/prompt";

export type CompletionRequest = {
  system: SystemBlocks | string;
  messages: ChatTurn[];
  maxTokens?: number;
  temperature?: number;
};

export type Usage = { inputTokens: number | null; outputTokens: number | null; cacheReadTokens: number | null };
export type Completion = { text: string; usage: Usage };

export interface LlmClient {
  readonly model: string;
  complete(req: CompletionRequest): Promise<Completion>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "upstream" | "overloaded" | "timeout" | "refused",
    readonly status?: number,
  ) {
    super(message);
  }
}

const API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Minimal Anthropic Messages API client over fetch (server only). The static part
 * of the system prompt is marked for prompt caching. Retries once on 429, 5xx and
 * overloaded responses.
 */
export class AnthropicClient implements LlmClient {
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutMs = 45_000,
  ) {
    if (!apiKey) throw new LlmError("ANTHROPIC_API_KEY is not set", "not_configured");
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
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    const system =
      typeof req.system === "string"
        ? req.system
        : [
            { type: "text", text: req.system.cached, cache_control: { type: "ephemeral" } },
            { type: "text", text: req.system.dynamic },
          ];
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        signal: ctl.signal,
        headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: this.model,
          max_tokens: req.maxTokens ?? 1000,
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          system,
          messages: req.messages,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const code = res.status === 529 || res.status === 429 ? "overloaded" : "upstream";
        throw new LlmError(`Anthropic API ${res.status}: ${body.slice(0, 300)}`, code, res.status);
      }
      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
        stop_reason?: string;
        usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number };
      };
      if (data.stop_reason === "refusal") throw new LlmError("Model refused", "refused");
      const text = (data.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");
      return {
        text,
        usage: {
          inputTokens: data.usage?.input_tokens ?? null,
          outputTokens: data.usage?.output_tokens ?? null,
          cacheReadTokens: data.usage?.cache_read_input_tokens ?? null,
        },
      };
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new LlmError("Anthropic API timed out", "timeout");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}
