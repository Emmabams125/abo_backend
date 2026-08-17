import type { PrivacyEntry } from "@/modules/privacy-center/privacy-entry.type";

/** FR-SOS-02/03: what an SOS trigger broadcasts, and who can see the log afterward. */
export async function getSosPrivacyEntries(): Promise<PrivacyEntry[]> {
  return [
    {
      feature: "SOS broadcast",
      description: "Triggering SOS sends your live location, battery %, and any medical info you've saved to the full Circle.",
      visibleTo: "All active Circle members (except you)",
    },
    {
      feature: "SOS event log",
      description: "Every SOS trigger is logged with who was notified, delivery status, and acknowledgment.",
      visibleTo: "Circle Admins",
    },
  ];
}
