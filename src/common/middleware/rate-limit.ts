import rateLimit from "express-rate-limit";

export function createRateLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // The integration test suite intentionally exercises many distinct phone numbers in
    // quick succession from a single test-runner IP — that's a test-harness artifact, not
    // the abuse pattern this limiter defends against, so it's skipped only in NODE_ENV=test.
    skip: () => process.env.NODE_ENV === "test",
    message: { error: { code: "TOO_MANY_REQUESTS", message: "Too many requests, please try again later." } },
  });
}

/** OTP requests are cheap to abuse (SMS cost, phone enumeration) — cap per IP. */
export const otpRequestLimiter = createRateLimiter(60_000, 5);

/** Community alerts are visible to any nearby user — cap posting to deter spam. */
export const communityAlertLimiter = createRateLimiter(60 * 60_000, 5);
