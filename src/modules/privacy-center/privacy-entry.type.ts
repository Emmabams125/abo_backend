export interface PrivacyEntry {
  feature: string;
  description: string;
  visibleTo: string;
}

export type PrivacyContributor = (circleId: string, userId: string) => Promise<PrivacyEntry[]>;
