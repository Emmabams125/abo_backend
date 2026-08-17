import { circlesRepository } from "@/modules/circles/circles.repository";
import type { PrivacyEntry } from "@/modules/privacy-center/privacy-entry.type";

/** FR-ONB-04: role changes are logged and visible in the Privacy Center. */
export async function getCirclePrivacyEntries(circleId: string, userId: string): Promise<PrivacyEntry[]> {
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership) return [];

  const entries: PrivacyEntry[] = [
    {
      feature: "Circle role",
      description: `Your role (${membership.role}) is visible to every active member of this Circle.`,
      visibleTo: "All active Circle members",
    },
    {
      feature: "Role changes",
      description: "Any change to your role is logged with who made the change and when.",
      visibleTo: "Circle Admins",
    },
  ];

  if (membership.role === "MANAGED") {
    entries.push({
      feature: "Managed Member setup",
      description: "Your Guardian set up this profile; you acknowledged what would be visible to them before setup completed.",
      visibleTo: "Circle Admins",
    });
  }

  return entries;
}
