import type { PrivacyEntry } from "@/modules/privacy-center/privacy-entry.type";

/** FR-RSR-01/02: "I'm Okay" check-ins and their history. */
export async function getReassurancePrivacyEntries(): Promise<PrivacyEntry[]> {
  return [
    {
      feature: "Check-ins ('I'm Okay')",
      description: "Your check-ins are visible to the Circle — no location, call, or message is attached.",
      visibleTo: "All active Circle members",
    },
  ];
}
