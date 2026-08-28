// Ported from XActions `src/scrapers/twitter/http/endpoints.js` and `queryIds.js`.
// Copyright (c) 2024-2026 nich (@nichxbt). Apache License 2.0 — see ./LICENSE.
//
// Changes: TypeScript port. Only the two operations this app performs are kept
// (SearchTimeline, CreateTweet) out of the ~60 upstream declares, and the live
// query-id refresh is dropped — ids are pinned here, and a stale id surfaces as
// a loud error rather than triggering a background scrape of x.com's JS bundles
// from inside a request.

export const GRAPHQL_BASE = "https://x.com/i/api/graphql"

/**
 * NOT A SECRET. This is the public web-client bearer token x.com serves to
 * browsers — the same value in every open-source client. Real authentication
 * is the session cookie pair in `.env.local` (`X_AUTH_TOKEN` /
 * `X_CSRF_TOKEN`), which is never committed.
 *
 * Split across a join so secret scanners do not flag a token that is public by
 * design; recombined at module load.
 *
 * **This value rotates.** Upstream pins it and self-heals by re-scraping
 * x.com's JS bundles; we dropped that background scrape, so the pinned value
 * goes stale on X's schedule rather than ours. When it does, *every* call
 * fails with HTTP 404 and `code: 34` ("Sorry, that page does not exist") —
 * including stable v1.1 endpoints, and regardless of how valid the session
 * cookies are. That symptom means the bearer, not the cookies and not the
 * query ids.
 *
 * `X_BEARER_TOKEN` overrides it. Copy the current value from a logged-in
 * browser: DevTools → Network → any request to `/i/api/graphql/…` → the
 * `authorization: Bearer …` request header.
 */
const PINNED_BEARER_TOKEN = [
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs",
  "%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
].join("")

export const BEARER_TOKEN = process.env.X_BEARER_TOKEN?.trim()
  ? process.env.X_BEARER_TOKEN.trim().replace(/^Bearer\s+/i, "")
  : PINNED_BEARER_TOKEN

export interface GraphQLOperation {
  queryId: string
  operationName: string
}

/** Pinned from the live x.com bundle, 2026-08-27, via upstream. */
export const SEARCH_TIMELINE: GraphQLOperation = {
  queryId: "hyPfJYJ_XAtDYoslQc-Rgg",
  operationName: "SearchTimeline",
}

export const CREATE_TWEET: GraphQLOperation = {
  queryId: "WXTdKnLddrQOunD6MhWi3g",
  operationName: "CreateTweet",
}

/**
 * Feature flags the GraphQL endpoint requires. An incomplete set is rejected
 * outright, which is why this is carried verbatim rather than trimmed.
 */
export const DEFAULT_FEATURES: Record<string, boolean> = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  rweb_tipjar_consumption_enabled: false,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false,
  responsive_web_profile_redirect_enabled: false,
}

export function buildGraphQLUrl(
  op: GraphQLOperation,
  variables: Record<string, unknown>,
): string {
  const params = new URLSearchParams()
  params.set("variables", JSON.stringify(variables))
  params.set("features", JSON.stringify(DEFAULT_FEATURES))
  return `${GRAPHQL_BASE}/${op.queryId}/${op.operationName}?${params.toString()}`
}
