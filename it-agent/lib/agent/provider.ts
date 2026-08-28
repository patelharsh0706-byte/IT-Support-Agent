import { openai } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

/**
 * The only file in the codebase that names a provider.
 *
 * `context/architecture.md` documents Amazon Bedrock (Claude) as the intended
 * provider and the AWS-sponsorship integration point; OpenAI is in use for
 * now because that is where working credentials are. Swapping back — or to
 * xAI/Grok, which `feature-specs/10-llm-integration.md` names as a later
 * candidate — is a change to these two lines and nothing else. That seam is
 * the main reason for using the AI SDK rather than a provider's own client.
 *
 * Model ids move. Override with `OPENAI_MODEL` rather than editing code when
 * a newer one ships.
 */

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini"

/** Classification: a six-label decision over short text. Small and cheap is fine. */
export function classifierModel(): LanguageModel {
  return openai(process.env.OPENAI_CLASSIFIER_MODEL ?? DEFAULT_MODEL)
}

/** The servicing turn: tool calling plus the closing sentence. */
export function servicingModel(): LanguageModel {
  return openai(DEFAULT_MODEL)
}
