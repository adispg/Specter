import { env } from "@/lib/env";
import { type LlmClient } from "./llm";
import { MockLlmClient } from "./mock";
import { GeminiClient } from "./gemini";

/** The model client for this environment: fixtures in MOCK_AI mode, Gemini otherwise. */
export function getLlm(): LlmClient {
  if (env.mockAI()) return new MockLlmClient();
  return new GeminiClient(env.geminiKey(), env.geminiModel());
}
