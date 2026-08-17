import type { NextFunction, Request, Response } from "express";
import type { SubscriptionTier } from "@prisma/client";
import { AppError } from "@/common/errors/app-error";
import { subscriptionRepository } from "@/modules/subscription/subscription.repository";

const TIER_RANK: Record<SubscriptionTier, number> = { FREE: 0, PREMIUM: 1, ENTERPRISE: 2 };

/**
 * FR-SUB-04: gated features (crash detection, driving insights, Screen Time
 * Limits, App Monitoring, Smart AI check-ins) live behind these keys. None of
 * these modules are built yet in this phase — this is the shared gate they'll
 * plug into so gating is consistent everywhere, not reinvented per module.
 */
export const FEATURE_MIN_TIER: Record<string, SubscriptionTier> = {
  crash_detection: "PREMIUM",
  driving_insights: "PREMIUM",
  screen_time_limits: "PREMIUM",
  app_monitoring: "PREMIUM",
  smart_ai_checkins: "PREMIUM",
};

export class UpgradeRequiredError extends AppError {
  constructor(feature: string, requiredTier: SubscriptionTier) {
    super(402, "UPGRADE_REQUIRED", `${feature} requires the ${requiredTier} plan`, { feature, requiredTier });
  }
}

export async function hasFeatureAccess(circleId: string, featureKey: string): Promise<boolean> {
  const requiredTier = FEATURE_MIN_TIER[featureKey];
  if (!requiredTier) return true; // ungated feature
  const subscription = await subscriptionRepository.getOrCreate(circleId);
  return TIER_RANK[subscription.tier] >= TIER_RANK[requiredTier];
}

/** Route middleware: expects `circleId` in req.params. Returns 402 + UPGRADE_REQUIRED, never a silent/broken UI state. */
export function requireFeature(featureKey: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const circleId = req.params.circleId!;
      const allowed = await hasFeatureAccess(circleId, featureKey);
      if (!allowed) {
        throw new UpgradeRequiredError(featureKey, FEATURE_MIN_TIER[featureKey]!);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
