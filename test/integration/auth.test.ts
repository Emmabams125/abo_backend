import request from "supertest";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { prisma } from "@/db/prisma.client";
import { mockEmailInbox } from "@/modules/auth/providers/mock-email.provider";
import { mockSmsInbox } from "@/modules/auth/providers/mock.provider";
import { nextPhone, signUpUser } from "../helpers/auth";

const app = createApp();

describe("Auth — FR-ONB-01 phone/OTP", () => {
  it("signs up a new user via OTP and issues session tokens", async () => {
    const { accessToken, userId } = await signUpUser(app);
    expect(accessToken).toBeTruthy();
    expect(userId).toBeTruthy();
  });

  it("rejects an incorrect code and locks out after too many attempts", async () => {
    const phone = nextPhone();
    await request(app).post("/auth/otp/request").send({ phone }).expect(202);

    // FR-ONB-01: max 5 attempts before lockout — the 5th wrong attempt itself trips it.
    for (let i = 0; i < 4; i++) {
      await request(app).post("/auth/otp/verify").send({ phone, code: "000000" }).expect(400);
    }
    await request(app).post("/auth/otp/verify").send({ phone, code: "000000" }).expect(403);

    // Further attempts remain locked out, even with the code never having been tried.
    const res = await request(app).post("/auth/otp/verify").send({ phone, code: "000000" });
    expect(res.status).toBe(403);
  });

  it("rejects resending an OTP within the resend cooldown window", async () => {
    const phone = nextPhone();
    await request(app).post("/auth/otp/request").send({ phone }).expect(202);
    const res = await request(app).post("/auth/otp/request").send({ phone });
    expect(res.status).toBe(429);
  });

  it("refreshes tokens and rejects the old refresh token after rotation", async () => {
    const { refreshToken } = await signUpUser(app);

    const refreshed = await request(app).post("/auth/refresh").send({ refreshToken }).expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    // Old refresh token should now be revoked (rotation).
    await request(app).post("/auth/refresh").send({ refreshToken }).expect(401);
  });

  it("rejects verification with a code that was never sent", async () => {
    const phone = nextPhone();
    await request(app).post("/auth/otp/request").send({ phone }).expect(202);
    const wrongCode = mockSmsInbox.get(phone) === "111111" ? "222222" : "111111";
    await request(app).post("/auth/otp/verify").send({ phone, code: wrongCode }).expect(400);
  });
});

describe("Auth — email OTP channel", () => {
  const originalChannel = env.OTP_CHANNEL;
  beforeAll(() => {
    env.OTP_CHANNEL = "email";
  });
  afterAll(() => {
    env.OTP_CHANNEL = originalChannel;
  });

  let emailCounter = 0;
  const nextEmail = () => `user${Date.now()}${++emailCounter}@example.com`;

  async function login(phone: string, email: string) {
    const sent = await request(app).post("/auth/otp/request").send({ phone, email }).expect(202);
    return { sent, code: mockEmailInbox.get(email) };
  }

  it("emails the code, signs up the user, and binds the email", async () => {
    const phone = nextPhone();
    const email = nextEmail();
    const { sent, code } = await login(phone, email);
    expect(sent.body).toMatchObject({ channel: "email", destination: `${email.slice(0, 2)}***@example.com` });
    expect(code).toBeTruthy();

    const res = await request(app).post("/auth/otp/verify").send({ phone, code }).expect(200);
    expect(res.body.isNewUser).toBe(true);
    const user = await prisma.user.findUnique({ where: { phone } });
    expect(user?.email).toBe(email);
  });

  it("requires an email for a phone with none bound", async () => {
    await request(app).post("/auth/otp/request").send({ phone: nextPhone() }).expect(400);
  });

  it("sends codes for a bound phone only to its bound email, whatever the client sends", async () => {
    const phone = nextPhone();
    const ownerEmail = nextEmail();
    const { code } = await login(phone, ownerEmail);
    await request(app).post("/auth/otp/verify").send({ phone, code }).expect(200);

    const attackerEmail = nextEmail();
    mockEmailInbox.delete(ownerEmail);
    const sent = await request(app).post("/auth/otp/request").send({ phone, email: attackerEmail }).expect(202);
    expect(sent.body.destination).toBe(`${ownerEmail.slice(0, 2)}***@example.com`);
    expect(mockEmailInbox.has(attackerEmail)).toBe(false);
    expect(mockEmailInbox.get(ownerEmail)).toBeTruthy();
  });

  it("rejects an email already bound to a different phone", async () => {
    const email = nextEmail();
    const first = nextPhone();
    const { code } = await login(first, email);
    await request(app).post("/auth/otp/verify").send({ phone: first, code }).expect(200);

    await request(app).post("/auth/otp/request").send({ phone: nextPhone(), email }).expect(400);
  });

  it("binds an email to an existing SMS-era account on its first email login", async () => {
    env.OTP_CHANNEL = "sms";
    const { phone, userId } = await signUpUser(app);
    env.OTP_CHANNEL = "email";

    const email = nextEmail();
    const { code } = await login(phone, email);
    const res = await request(app).post("/auth/otp/verify").send({ phone, code }).expect(200);
    expect(res.body).toMatchObject({ userId, isNewUser: false });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.email).toBe(email);
  });
});
