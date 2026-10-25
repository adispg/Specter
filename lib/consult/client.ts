import { env } from "@/lib/env";
import { AnthropicClient, type LlmClient } from "./llm";
import { MockLlmClient } from "./mock";

/** The model client for this environment: fixtures in MOCK_AI mode, Anthropic otherwise. */
export function getLlm(): LlmClient {
  if (env.mockAI()) return new MockLlmClient();
  return new AnthropicClient(env.anthropicKey(), env.anthropicModel());
}
