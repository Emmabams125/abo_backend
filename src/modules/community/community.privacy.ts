import type { PrivacyEntry } from "@/modules/privacy-center/privacy-entry.type";

/** Community alerts are cross-circle by design — not scoped to any one Circle. */
export async function getCommunityPrivacyEntries(): Promise<PrivacyEntry[]> {
  return [
    {
      feature: "Community alerts",
      description:
        "Alerts you post (title, kind, place label, approximate distance) are visible to any signed-in user within the alert's search radius. Your exact coordinates are never shown to other users.",
      visibleTo: "Any signed-in user near the alert",
    },
  ];
}
