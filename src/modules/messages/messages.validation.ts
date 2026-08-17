import { z } from "zod";

export const createConversationSchema = z.object({
  circleId: z.string().uuid(),
  participantIds: z.array(z.string().uuid()).min(1),
  isGroup: z.boolean().default(false),
});

export const conversationParamsSchema = z.object({
  conversationId: z.string().uuid(),
});

/** FR-MSG-03 durations: 15 min / 1 hr / until I turn it off. Omit entirely for no location share. */
export const sendMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  locationShare: z.enum(["15m", "1h", "untilOff"]).optional(),
});

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.coerce.date().optional(),
});

export const messageParamsSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});
