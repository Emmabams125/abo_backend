import { prisma } from "@/db/prisma.client";
import { env } from "@/config/env";
import type { PrivacyEntry } from "@/modules/privacy-center/privacy-entry.type";

/** FR-LOC-01/02/03: location sharing, Safe Place events, and history retention. */
export async function getLocationPrivacyEntries(circleId: string): Promise<PrivacyEntry[]> {
  const retention = await prisma.locationRetentionSetting.findUnique({ where: { circleId } });
  const retentionDays = retention?.retentionDays ?? env.LOCATION_RETENTION_DEFAULT_DAYS;

  return [
    {
      feature: "Live location",
      description: "Your live location is visible to every active member of this Circle.",
      visibleTo: "All active Circle members",
    },
    {
      feature: "Safe Place arrivals/departures",
      description: "When you arrive at or leave a named Safe Place, the Circle is notified.",
      visibleTo: "All active Circle members",
    },
    {
      feature: "Location history",
      description: `Your location history is kept for ${retentionDays} day(s) before being deleted.`,
      visibleTo: "All active Circle members",
    },
  ];
}
