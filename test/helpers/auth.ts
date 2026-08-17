import type { Express } from "express";
import request from "supertest";
import { mockSmsInbox } from "@/modules/auth/providers/mock.provider";

let counter = 0;

/**
 * Generates a fresh E.164 phone number per call. Must be unique across the whole
 * test run, not just within one file — Jest gives each test file its own module
 * registry, so a plain in-file counter restarts at each file and collides with
 * numbers other files already used (some intentionally left with an unconsumed
 * OTP challenge), tripping the resend-cooldown. Seeding from Date.now() keeps it
 * unique across files since real wall-clock time only moves forward.
 */
export function nextPhone(): string {
  counter += 1;
  const unique = `${Date.now()}${counter}`.slice(-9);
  return `+234${unique}`;
}

export async function signUpUser(app: Express, phone = nextPhone()) {
  await request(app).post("/auth/otp/request").send({ phone }).expect(202);
  const code = mockSmsInbox.get(phone);
  if (!code) throw new Error(`No OTP code captured for ${phone}`);

  const res = await request(app).post("/auth/otp/verify").send({ phone, code }).expect(200);
  return {
    phone,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
    userId: res.body.userId as string,
  };
}
