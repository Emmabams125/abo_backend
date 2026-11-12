import { env } from "@/config/env";
import { MockEmailProvider } from "@/modules/auth/providers/mock-email.provider";
import { SmtpEmailProvider } from "@/modules/auth/providers/smtp-email.provider";
import type { EmailProvider } from "@/modules/auth/email-provider.interface";

export function createEmailProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case "smtp":
      return new SmtpEmailProvider();
    case "mock":
    default:
      return new MockEmailProvider();
  }
}
