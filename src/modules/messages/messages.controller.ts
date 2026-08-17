import type { Request, Response } from "express";
import { messagesService } from "@/modules/messages/messages.service";

export const messagesController = {
  async createConversation(req: Request, res: Response) {
    const { circleId, participantIds, isGroup } = req.body;
    const conversation = await messagesService.createConversation(circleId, req.userId!, participantIds, isGroup);
    res.status(201).json(conversation);
  },

  async listConversations(req: Request, res: Response) {
    const conversations = await messagesService.listConversations(req.userId!);
    res.status(200).json(conversations);
  },

  async sendMessage(req: Request, res: Response) {
    const { body, locationShare } = req.body;
    const message = await messagesService.sendMessage(
      req.params.conversationId!,
      req.userId!,
      body,
      locationShare
    );
    res.status(201).json(message);
  },

  async listMessages(req: Request, res: Response) {
    const { limit, before } = req.query as unknown as { limit: number; before?: Date };
    const messages = await messagesService.listMessages(req.params.conversationId!, req.userId!, limit, before);
    res.status(200).json(messages);
  },

  async stopLocationShare(req: Request, res: Response) {
    const message = await messagesService.stopLocationShare(
      req.params.conversationId!,
      req.params.messageId!,
      req.userId!
    );
    res.status(200).json(message);
  },
};
