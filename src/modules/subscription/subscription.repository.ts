import { prisma } from "@/db/prisma.client";
import type { BillingProvider, SubscriptionTier } from "@prisma/client";

export const subscriptionRepository = {
  async getOrCreate(circleId: string) {
    const existing = await prisma.subscription.findUnique({ where: { circleId } });
    if (existing) return existing;
    return prisma.subscription.create({ data: { circleId, tier: "FREE" } });
  },

  applyTierChange(
    circleId: string,
    tier: SubscriptionTier,
    billingProvider: BillingProvider,
    renewsAt: Date
  ) {
    return prisma.subscription.update({
      where: { circleId },
      data: { tier, billingProvider, renewsAt, status: "ACTIVE", pendingTier: null },
    });
  },

  schedulePendingDowngrade(circleId: string, pendingTier: SubscriptionTier) {
    return prisma.subscription.update({
      where: { circleId },
      data: { pendingTier, status: "DOWNGRADE_PENDING" },
    });
  },

  async applyPendingDowngrade(circleId: string) {
    const sub = await prisma.subscription.findUnique({ where: { circleId } });
    if (!sub?.pendingTier) return sub;
    return prisma.subscription.update({
      where: { circleId },
      data: { tier: sub.pendingTier, pendingTier: null, status: "ACTIVE" },
    });
  },

  createInvoice(subscriptionId: string, amountCents: number, currency: string, externalRef?: string) {
    return prisma.invoice.create({ data: { subscriptionId, amountCents, currency, externalRef } });
  },

  /** FR-SUB-03: at least the last 12 months. */
  listInvoices(subscriptionId: string) {
    const since = new Date(Date.now() - 366 * 86_400_000);
    return prisma.invoice.findMany({
      where: { subscriptionId, issuedAt: { gte: since } },
      orderBy: { issuedAt: "desc" },
    });
  },
};
