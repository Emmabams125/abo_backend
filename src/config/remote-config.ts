import { logger } from "@/common/utils/logger";

export interface PlanDefinition {
  tier: "FREE" | "PREMIUM" | "ENTERPRISE";
  name: string;
  priceMinorUnits: number;
  currency: string;
  billingPeriod: "monthly" | "yearly";
  features: string[];
}

const DEFAULT_PLANS: PlanDefinition[] = [
  {
    tier: "FREE",
    name: "Free",
    priceMinorUnits: 0,
    currency: "NGN",
    billingPeriod: "monthly",
    features: ["Live Location", "SOS", "Reassurance Mode", "Messages", "1 Family Circle"],
  },
  {
    tier: "PREMIUM",
    name: "Premium",
    priceMinorUnits: 250000,
    currency: "NGN",
    billingPeriod: "monthly",
    features: [
      "Everything in Free",
      "Item Tracking (Abo Tags)",
      "Driving Insights & Crash Detection",
      "Screen Time Limits",
      "App Monitoring",
      "Smart AI Check-ins",
    ],
  },
  {
    tier: "ENTERPRISE",
    name: "Enterprise",
    priceMinorUnits: 0,
    currency: "NGN",
    billingPeriod: "monthly",
    features: ["Everything in Premium", "Multiple Circles", "Priority Support"],
  },
];

let cache: { plans: PlanDefinition[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60_000;

/**
 * FR-SUB-01: pricing must come from remote config, not be hardcoded into the
 * app, so it can change without an app release. Fetches from PRICING_CONFIG_URL
 * if configured, with a short in-memory cache; falls back to defaults if unset
 * or unreachable so the plans screen never hard-fails.
 */
export async function getPlanDefinitions(): Promise<PlanDefinition[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.plans;
  }

  const url = process.env.PRICING_CONFIG_URL;
  if (!url) {
    cache = { plans: DEFAULT_PLANS, fetchedAt: Date.now() };
    return DEFAULT_PLANS;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const plans = (await res.json()) as PlanDefinition[];
    cache = { plans, fetchedAt: Date.now() };
    return plans;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch remote pricing config — falling back to defaults");
    return cache?.plans ?? DEFAULT_PLANS;
  }
}
