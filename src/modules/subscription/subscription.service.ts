import type { BillingProvider, SubscriptionTier } from "@prisma/client";
import { BadRequestError, ForbiddenError } from "@/common/errors/app-error";
import { getPlanDefinitions } from "@/config/remote-config";
import { circlesRepository } from "@/modules/circles/circles.repository";
import { cancelScheduledDowngrade, scheduleDowngrade } from "@/modules/subscription/downgrade.queue";
import { subscriptionRepository } from "@/modules/subscription/subscription.repository";

const TIER_RANK: Record<SubscriptionTier, number> = { FREE: 0, PREMIUM: 1, ENTERPRISE: 2 };
const BILLING_PERIOD_MS = 30 * 86_400_000;

async function requireActiveMembership(circleId: string, userId: string) {
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new ForbiddenError("You are not a member of this Circle");
  }
  return membership;
}

export const subscriptionService = {
  /** FR-SUB-01: plan comparison, pricing sourced from remote config. */
  getPlans() {
    return getPlanDefinitions();
  },

  getSubscription(circleId: string) {
    return subscriptionRepository.getOrCreate(circleId);
  },

  /** FR-SUB-02: upgrades apply immediately; downgrades apply at the end of the current billing period. */
  async changeTier(circleId: string, actorId: string, newTier: SubscriptionTier, billingProvider: BillingProvider) {
    await requireActiveMembership(circleId, actorId);
    const current = await subscriptionRepository.getOrCreate(circleId);

    if (newTier === current.tier) {
      throw new BadRequestError("Circle is already on this plan");
    }

    const isUpgrade = TIER_RANK[newTier] > TIER_RANK[current.tier];

    if (isUpgrade) {
      await cancelScheduledDowngrade(circleId).catch(() => undefined);
      const renewsAt = new Date(Date.now() + BILLING_PERIOD_MS);
      return subscriptionRepository.applyTierChange(circleId, newTier, billingProvider, renewsAt);
    }

    const effectiveAt = current.renewsAt ?? new Date(Date.now() + BILLING_PERIOD_MS);
    await cancelScheduledDowngrade(circleId).catch(() => undefined);
    await scheduleDowngrade(circleId, effectiveAt);
    return subscriptionRepository.schedulePendingDowngrade(circleId, newTier);
  },

  /** FR-SUB-03: invoice history, at least the last 12 months. */
  async listInvoices(circleId: string, requesterId: string) {
    await requireActiveMembership(circleId, requesterId);
    const subscription = await subscriptionRepository.getOrCreate(circleId);
    return subscriptionRepository.listInvoices(subscription.id);
  },
};
