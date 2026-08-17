import { Router } from "express";
import { requireAuth } from "@/common/middleware/auth";
import { validate } from "@/common/middleware/validate";
import { asyncHandler } from "@/common/utils/async-handler";
import { messagesController } from "@/modules/messages/messages.controller";
import {
  conversationParamsSchema,
  createConversationSchema,
  listMessagesQuerySchema,
  messageParamsSchema,
  sendMessageSchema,
} from "@/modules/messages/messages.validation";

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

messagesRouter.post(
  "/conversations",
  validate({ body: createConversationSchema }),
  asyncHandler(messagesController.createConversation)
);

messagesRouter.get("/conversations", asyncHandler(messagesController.listConversations));

messagesRouter.post(
  "/conversations/:conversationId/messages",
  validate({ params: conversationParamsSchema, body: sendMessageSchema }),
  asyncHandler(messagesController.sendMessage)
);

messagesRouter.get(
  "/conversations/:conversationId/messages",
  validate({ params: conversationParamsSchema, query: listMessagesQuerySchema }),
  asyncHandler(messagesController.listMessages)
);

messagesRouter.post(
  "/conversations/:conversationId/messages/:messageId/stop-location-share",
  validate({ params: messageParamsSchema }),
  asyncHandler(messagesController.stopLocationShare)
);
