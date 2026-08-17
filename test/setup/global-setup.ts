import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/** Wipes all app tables before the test run so integration tests start from a known-empty state. */
export default async function globalSetup() {
  const prisma = new PrismaClient();
  const tables = [
    "audit_logs",
    "invoices",
    "subscriptions",
    "messages",
    "conversation_participants",
    "conversations",
    "check_in_reminders",
    "check_ins",
    "sos_notifications",
    "sos_events",
    "location_retention_settings",
    "safe_place_events",
    "safe_places",
    "location_pings",
    "circle_invites",
    "circle_memberships",
    "family_circles",
    "devices",
    "refresh_tokens",
    "otp_challenges",
    "users",
  ];

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE;`);
  await prisma.$disconnect();
}
