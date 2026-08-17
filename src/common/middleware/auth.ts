import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "@/common/errors/app-error";
import { verifyAccessToken, verifyReauthToken } from "@/common/utils/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      deviceId?: string;
      reauthedUserId?: string;
    }
  }
}

function extractBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }
  return header.slice("Bearer ".length);
}

/** Requires a valid access token; attaches req.userId / req.deviceId. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.deviceId = payload.deviceId;
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired access token"));
  }
}

/**
 * Requires a fresh reauth token (X-Reauth-Token header) matching req.userId,
 * for sensitive actions per FR-ONB-04 / FR-PRO-02 (role changes, account deletion).
 * Must run after requireAuth.
 */
export function requireReauth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.header("X-Reauth-Token");
    if (!token) throw new Error("Missing reauth token");
    const payload = verifyReauthToken(token);
    if (payload.userId !== req.userId) throw new Error("Reauth token does not match session");
    req.reauthedUserId = payload.userId;
    next();
  } catch {
    next(new UnauthorizedError("This action requires re-authentication (PIN/biometric)"));
  }
}
