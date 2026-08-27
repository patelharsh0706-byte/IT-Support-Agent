// Ported from XActions `src/scrapers/twitter/http/errors.js`.
// Copyright (c) 2024-2026 nich (@nichxbt). Apache License 2.0 — see ./LICENSE.
// Changes: TypeScript port; only the three error types this app raises.

export class TwitterApiError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "TwitterApiError"
    this.status = status
  }
}

export class AuthError extends TwitterApiError {
  constructor(message = "Authentication required") {
    super(message, 401)
    this.name = "AuthError"
  }
}

export class RateLimitError extends TwitterApiError {
  constructor(message = "Rate limited by the platform") {
    super(message, 429)
    this.name = "RateLimitError"
  }
}
