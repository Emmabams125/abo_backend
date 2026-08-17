import { BadRequestError, ForbiddenError, NotFoundError } from "@/common/errors/app-error";
import { prisma } from "@/db/prisma.client";
import { circlesRepository } from "@/modules/circles/circles.repository";
import { messagesRepository } from "@/modules/messages/messages.repository";
import { scheduleLocationShareExpiry } from "@/modules/messages/location-share.queue";
import { enqueuePush } from "@/queues/push.queue";
import { emitToCircle } from "@/realtime/socket.server";
import {
  SocketEvents,
  type LocationShareEndedPayload,
  type MessageSentPayload,
} from "@/realtime/events";

const SHARE_DURATIONS_MS: Record<"15m" | "1h", number> = {
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
};

async function requireActiveMembership(circleId: string, userId: string) {
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new ForbiddenError("You are not a member of this Circle");
  }
}

async function requireParticipant(conversationId: string, userId: string) {
  const isParticipant = await messagesRepository.isParticipant(conversationId, userId);
  if (!isParticipant) throw new ForbiddenError("You are not part of this conversation");
}

export const messagesService = {
  /** FR-MSG-01: 1:1 conversations are deduplicated; group conversations are created fresh each time. */
  async createConversation(circleId: string, actorId: string, participantIds: string[], isGroup: boolean) {
    const allParticipants = Array.from(new Set([actorId, ...participantIds]));
    for (const userId of allParticipants) {
      await requireActiveMembership(circleId, userId);
    }

    if (!isGroup) {
      if (allParticipants.length !== 2) {
        throw new BadRequestError("A direct conversation must have exactly two participants");
      }
      const [a, b] = allParticipants as [string, string];
      const existing = await messagesRepository.findDirectConversation(circleId, a, b);
      if (existing) return existing;
    }

    return messagesRepository.createConversation(circleId, allParticipants, isGroup);
  },

  listConversations(userId: string) {
    return messagesRepository.listConversationsForUser(userId);
  },

  /** FR-MSG-01/03: sends a message, optionally starting a time-boxed location share. */
  async sendMessage(
    conversationId: string,
    senderId: string,
    body: string,
    locationShare?: "15m" | "1h" | "untilOff"
  ) {
    await requireParticipant(conversationId, senderId);
    const conversation = await messagesRepository.findConversationById(conversationId);
    if (!conversation) throw new NotFoundError("Conversation not found");

    const expiresAt = locationShare && locationShare !== "untilOff" ? new Date(Date.now() + SHARE_DURATIONS_MS[locationShare]) : null;
    const untilOff = locationShare === "untilOff";

    const message = await messagesRepository.createMessage(conversationId, senderId, body, {
      expiresAt,
      untilOff,
    });

    if (expiresAt) {
      await scheduleLocationShareExpiry({ messageId: message.id, conversationId, senderId }, expiresAt);
    }

    const payload: MessageSentPayload = {
      conversationId,
      messageId: message.id,
      senderId,
      body,
      sentAt: message.sentAt.toISOString(),
    };
    emitToCircle(conversation.circleId, SocketEvents.MessageSent, payload);

    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    for (const participant of conversation.participants) {
      if (participant.userId === senderId) continue;
      await enqueuePush({
        userId: participant.userId,
        message: {
          title: sender?.name ?? "Abo",
          body,
          data: { type: "message", conversationId },
        },
      });
    }

    return message;
  },

  async listMessages(conversationId: string, requesterId: string, limit: number, before?: Date) {
    await requireParticipant(conversationId, requesterId);
    return messagesRepository.listMessages(conversationId, limit, before);
  },

  /** Manual stop — the sharer turns off a "until I turn it off" share early. */
  async stopLocationShare(conversationId: string, messageId: string, actorId: string) {
    await requireParticipant(conversationId, actorId);
    const message = await messagesRepository.findMessageById(messageId);
    if (!message || message.conversationId !== conversationId) throw new NotFoundError("Message not found");
    if (message.senderId !== actorId) throw new ForbiddenError("Only the sharer can stop this share");
    if (message.locationShareEndedAt) return message;

    return messagesService.expireLocationShare(messageId);
  },

  /** Shared by the manual-stop endpoint and the scheduled auto-expiry worker — ends a share and notifies both parties. */
  async expireLocationShare(messageId: string) {
    const message = await messagesRepository.findMessageById(messageId);
    if (!message || message.locationShareEndedAt) return message;

    const updated = await messagesRepository.endLocationShare(messageId);
    const conversation = await messagesRepository.findConversationById(message.conversationId);
    if (!conversation) return updated;

    const payload: LocationShareEndedPayload = {
      conversationId: message.conversationId,
      senderId: message.senderId,
      messageId,
    };
    emitToCircle(conversation.circleId, SocketEvents.LocationShareEnded, payload);

    for (const participant of conversation.participants) {
      await enqueuePush({
        userId: participant.userId,
        message: {
          title: "Abo",
          body: "A shared location in this conversation has expired",
          data: { type: "location-share-ended", conversationId: message.conversationId },
        },
      });
    }

    return updated;
  },
};
