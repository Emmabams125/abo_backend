import request from "supertest";
import { createApp } from "@/app";
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
