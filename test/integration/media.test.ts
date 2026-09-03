import request from "supertest";

// Mocked so this test doesn't need a real Supabase Storage key — it verifies
// media.service.ts's own logic (bucket/path selection per purpose, and that
// publicUrl is only ever returned for the public "community" bucket), not
// Supabase's actual signing behavior.
jest.mock("@/storage/supabase-storage", () => ({
  createUploadUrl: jest.fn(async (bucket: string, path: string) => ({
    uploadUrl: `https://example.supabase.co/storage/v1/object/upload/sign/${bucket}/${path}?token=fake`,
    path,
  })),
  getPublicUrl: jest.fn((bucket: string, path: string) => `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`),
}));

// Imported after the mock so createApp's module graph picks up the mocked storage module.
import { createApp } from "@/app";
import { signUpUser } from "../helpers/auth";

const app = createApp();

describe("Media upload URLs", () => {
  it("returns a public URL for the community purpose", async () => {
    const user = await signUpUser(app);

    const res = await request(app)
      .post("/media/upload-url")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ purpose: "community", contentType: "image/jpeg" })
      .expect(200);

    expect(res.body.uploadUrl).toContain("community-media");
    expect(res.body.path).toMatch(new RegExp(`^${user.userId}/.+\\.jpg$`));
    expect(res.body.publicUrl).toContain("community-media");
  });

  it("does not return a public URL for the private sos-video purpose", async () => {
    const user = await signUpUser(app);

    const res = await request(app)
      .post("/media/upload-url")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ purpose: "sos-video", contentType: "video/mp4" })
      .expect(200);

    expect(res.body.uploadUrl).toContain("sos-videos");
    expect(res.body.path).toMatch(new RegExp(`^${user.userId}/.+\\.mp4$`));
    expect(res.body.publicUrl).toBeUndefined();
  });

  it("rejects an unsupported content type", async () => {
    const user = await signUpUser(app);

    await request(app)
      .post("/media/upload-url")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ purpose: "community", contentType: "application/pdf" })
      .expect(400);
  });
});
