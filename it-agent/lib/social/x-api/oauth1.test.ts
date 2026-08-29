import { describe, expect, it } from "vitest"

import { buildAuthorizationHeader, percentEncode, signatureBaseString } from "./oauth1"

const CREDENTIALS = {
  consumerKey: "ck",
  consumerSecret: "cs",
  accessToken: "at",
  accessTokenSecret: "ats",
}

// The characters encodeURIComponent leaves alone but OAuth requires escaped.
// A reply containing an apostrophe is completely ordinary, and getting this
// wrong makes exactly those replies fail to post.
describe("percent encoding follows RFC 3986, not encodeURIComponent", () => {
  it("escapes !*'()", () => {
    expect(percentEncode("!*'()")).toBe("%21%2A%27%28%29")
  })

  it("leaves the unreserved set alone", () => {
    expect(percentEncode("aZ0-._~")).toBe("aZ0-._~")
  })

  it("escapes the separators that would otherwise break the base string", () => {
    expect(percentEncode("a&b=c")).toBe("a%26b%3Dc")
  })
})

describe("the signature base string", () => {
  it("is METHOD, url and params, each percent-encoded and joined by &", () => {
    expect(signatureBaseString("post", "https://api.x.com/2/tweets", { b: "2", a: "1" })).toBe(
      "POST&https%3A%2F%2Fapi.x.com%2F2%2Ftweets&a%3D1%26b%3D2",
    )
  })

  it("sorts by encoded key, then by encoded value on a tie", () => {
    const base = signatureBaseString("GET", "https://api.x.com/2/x", {
      q: "z",
      a: "1",
      B: "2",
    })
    // Uppercase sorts before lowercase, so B precedes a.
    expect(base.endsWith("B%3D2%26a%3D1%26q%3Dz")).toBe(true)
  })

  it("encodes parameter values before joining, so a value cannot forge a pair", () => {
    const base = signatureBaseString("GET", "https://api.x.com/2/x", { a: "1&b=2" })
    expect(base).toContain("a%3D1%2526b%253D2")
  })
})

describe("the Authorization header", () => {
  const header = buildAuthorizationHeader({
    method: "POST",
    url: "https://api.x.com/2/tweets",
    credentials: CREDENTIALS,
    nonce: "fixed-nonce",
    timestamp: 1_700_000_000,
  })

  it("declares HMAC-SHA1 and OAuth 1.0", () => {
    expect(header).toContain('oauth_signature_method="HMAC-SHA1"')
    expect(header).toContain('oauth_version="1.0"')
  })

  it("carries the consumer key and the user access token", () => {
    expect(header).toContain('oauth_consumer_key="ck"')
    expect(header).toContain('oauth_token="at"')
  })

  it("includes a percent-encoded signature", () => {
    const match = header.match(/oauth_signature="([^"]+)"/)
    expect(match).not.toBeNull()
    // Base64 padding and + must be escaped or the header is unparseable.
    expect(match![1]).not.toMatch(/[+/=]/)
  })

  it("never leaks either secret", () => {
    expect(header).not.toContain("cs")
    expect(header).not.toContain("ats")
  })

  it("is deterministic for a fixed nonce and timestamp", () => {
    const again = buildAuthorizationHeader({
      method: "POST",
      url: "https://api.x.com/2/tweets",
      credentials: CREDENTIALS,
      nonce: "fixed-nonce",
      timestamp: 1_700_000_000,
    })
    expect(again).toBe(header)
  })

  it("changes when the request does", () => {
    const other = buildAuthorizationHeader({
      method: "GET",
      url: "https://api.x.com/2/tweets",
      credentials: CREDENTIALS,
      nonce: "fixed-nonce",
      timestamp: 1_700_000_000,
    })
    expect(other).not.toBe(header)
  })
})
