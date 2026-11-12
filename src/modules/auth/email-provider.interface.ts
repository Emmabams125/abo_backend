export interface EmailProvider {
  sendOtp(email: string, code: string): Promise<void>;
}
