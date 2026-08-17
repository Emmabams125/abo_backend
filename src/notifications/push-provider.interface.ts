export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushSendResult {
  success: boolean;
  error?: string;
}

export interface PushProvider {
  send(pushToken: string, message: PushMessage): Promise<PushSendResult>;
}
