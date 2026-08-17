import { prisma } from "@/db/prisma.client";

export const messagesRepository = {
  async findDirectConversation(circleId: string, userAId: string, userBId: string) {
    const conversations = await prisma.conversation.findMany({
      where: {
        circleId,
        isGroup: false,
        participants: { some: { userId: userAId } },
      },
      include: { participants: true },
    });
    return (
      conversations.find(
        (c) => c.participants.length === 2 && c.participants.some((p) => p.userId === userBId)
      ) ?? null
    );
  },

  createConversation(circleId: string, participantIds: string[], isGroup: boolean) {
    return prisma.conversation.create({
      data: {
        circleId,
        isGroup,
        participants: { createMany: { data: participantIds.map((userId) => ({ userId })) } },
      },
      include: { participants: true },
    });
  },

  findConversationById(conversationId: string) {
    return prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });
  },

  listConversationsForUser(userId: string) {
    return prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: { participants: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  isParticipant(conversationId: string, userId: string) {
    return prisma.conversationParticipant
      .findUnique({ where: { conversationId_userId: { conversationId, userId } } })
      .then((row) => row !== null);
  },

  createMessage(
    conversationId: string,
    senderId: string,
    body: string,
    locationShare?: { expiresAt: Date | null; untilOff: boolean }
  ) {
    return prisma.message.create({
      data: {
        conversationId,
        senderId,
        body,
        locationShareExpiresAt: locationShare?.expiresAt ?? null,
        locationShareUntilOff: locationShare?.untilOff ?? false,
      },
    });
  },

  listMessages(conversationId: string, limit: number, before?: Date) {
    return prisma.message.findMany({
      where: { conversationId, sentAt: before ? { lt: before } : undefined },
      orderBy: { sentAt: "desc" },
      take: limit,
    });
  },

  findMessageById(messageId: string) {
    return prisma.message.findUnique({ where: { id: messageId } });
  },

  endLocationShare(messageId: string) {
    return prisma.message.update({ where: { id: messageId }, data: { locationShareEndedAt: new Date() } });
  },

  findActiveLocationShare(conversationId: string, senderId: string) {
    return prisma.message.findFirst({
      where: {
        conversationId,
        senderId,
        locationShareEndedAt: null,
        OR: [{ locationShareUntilOff: true }, { locationShareExpiresAt: { not: null } }],
      },
      orderBy: { sentAt: "desc" },
    });
  },
};
