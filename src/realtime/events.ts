/** Typed Socket.io event names + payloads, shared across modules. All events are scoped to a `circle:{circleId}` room. */

export const SocketEvents = {
  LocationUpdated: "location:updated",
  SafePlaceEvent: "safe-place:event",
  SosTriggered: "sos:triggered",
  SosAcknowledged: "sos:acknowledged",
  CheckInCreated: "check-in:created",
  MessageSent: "message:sent",
  LocationShareEnded: "location-share:ended",
  MembershipChanged: "membership:changed",
} as const;

export interface LocationUpdatedPayload {
  userId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  batteryPct?: number;
  recordedAt: string;
}

export interface SafePlaceEventPayload {
  safePlaceId: string;
  safePlaceName: string;
  userId: string;
  type: "ARRIVAL" | "DEPARTURE";
  occurredAt: string;
}

export interface SosTriggeredPayload {
  sosEventId: string;
  userId: string;
  triggeredAt: string;
  location: { lat: number; lng: number };
  batteryPct?: number;
}

export interface SosAcknowledgedPayload {
  sosEventId: string;
  memberId: string;
  acknowledgedAt: string;
}

export interface CheckInCreatedPayload {
  userId: string;
  createdAt: string;
}

export interface MessageSentPayload {
  conversationId: string;
  messageId: string;
  senderId: string;
  body: string;
  sentAt: string;
}

export interface LocationShareEndedPayload {
  conversationId: string;
  senderId: string;
  messageId: string;
}

export interface MembershipChangedPayload {
  membershipId: string;
  userId: string;
  action:
    | "ROLE_CHANGED"
    | "MEMBER_REMOVED"
    | "MEMBERSHIP_APPROVED"
    | "MEMBERSHIP_REQUESTED"
    | "MEMBERSHIP_DECLINED";
}
