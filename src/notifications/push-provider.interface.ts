/** Android notification channels the app creates (see the app's push service). */
export type PushChannel = "sos_alerts" | "circle_updates";

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Defaults to "circle_updates". SOS uses the high-importance "sos_alerts". */
  channel?: PushChannel;
}

export interface PushSendResult {
  success: boolean;
  error?: string;
  /** The token is dead (app uninstalled / token rotated): stop sending to it. */
  invalidToken?: boolean;
}

export interface PushProvider {
  send(pushToken: string, message: PushMessage): Promise<PushSendResult>;
}
