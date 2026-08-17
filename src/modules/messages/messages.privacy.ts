import type { PrivacyEntry } from "@/modules/privacy-center/privacy-entry.type";

/** FR-MSG-03: time-boxed location shares are scoped to a single conversation, not the whole Circle. */
export async function getMessagesPrivacyEntries(): Promise<PrivacyEntry[]> {
  return [
    {
      feature: "Location shares in chat",
      description: "Sharing your location into a conversation is only visible to that conversation's participants, and auto-expires (or you can turn it off).",
      visibleTo: "Participants of that conversation only",
    },
  ];
}
