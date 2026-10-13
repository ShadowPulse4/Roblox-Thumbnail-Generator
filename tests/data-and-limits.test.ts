import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { getConfig } from "@/lib/config";
import {
  createGeneration,
  createUser,
  deleteImageForUser,
  ensureLocalUser,
  getGenerationForUser,
  getImageForUser,
  insertImage,
  listCreations,
  setFavorite,
  type NewGeneration,
} from "@/lib/database/repo";
import { startGeneration, runGeneration, type GenerationTask } from "@/lib/jobs/generation";
import { assertCanGenerate } from "@/lib/usage/limits";
import { getUsageSummary, recordUsage } from "@/lib/usage/records";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { saveImageFile, readImageFile } from "@/lib/storage/local";
import { DEFAULT_OVERLAY } from "@/lib/overlay/layout";
import { fakeProvider, setupTestEnv } from "./helpers/env";

let dataDir: string;
beforeEach(() => {
  dataDir = setupTestEnv();
});

function gen(userId: string, overrides: Partial<NewGeneration> = {}): string {
  return createGeneration({
    userId,
    kind: "generate",
    parentImageId: null,
    prompt: "nugget king",
    enhancedPrompt: null,
    finalPrompt: "nugget king, style",
    aspectRatio: "16:9",
    visualStyle: "cinematic-3d",
    quality: "standard",
    providerQuality: "medium",
    imageCount: 1,
    imageProvider: "openai",
    imageModel: "gpt-image-2",
    overlay: null,
    ...overrides,
  });
}

function image(userId: string, generationId: string, id = crypto.randomUUID()) {
  insertImage({ id, generationId, userId, storagePath: `${userId}/${id}.png`, width: 10, height: 10, format: "png", bytes: 1, parentImageId: null, overlay: null });
  return id;
}

async function member(name: string, limit: number | null = null) {
  return createUser({ username: name, displayName: name, passwordHash: await hashPassword("password1234"), role: "member", dailyImageLimit: limit });
}

describe("access control", () => {
  it("never returns another user's generations, images or favorites", async () => {
    const alice = await member("alice");
    const bob = await member("bob");
    const g = gen(alice.id);
    const img = image(alice.id, g);

    expect(getGenerationForUser(alice.id, g)).not.toBeNull();
    expect(getGenerationForUser(bob.id, g)).toBeNull();
    expect(getImageForUser(bob.id, img)).toBeNull();
    expect(listCreations(bob.id, {}).total).toBe(0);
    expect(setFavorite(bob.id, img, true)).toBe(false);
    expect(deleteImageForUser(bob.id, img)).toBeNull();
    // Alice's data is untouched.
    expect(getImageForUser(alice.id, img)).not.toBeNull();
  });

  it("refuses storage paths that escape the data folder", async () => {
    await expect(readImageFile("../../etc/passwd")).rejects.toThrow();
    await expect(saveImageFile("../x", "id", Buffer.from(""), "png")).rejects.toThrow();
  });

  it("hashes passwords and verifies them", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("correct");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });
});

describe("generation history", () => {
  it("searches, filters, sorts and lists favorites", async () => {
    const u = ensureLocalUser();
    const g1 = gen(u.id, { prompt: "lava dragon boss", visualStyle: "boss-fight" });
    const i1 = image(u.id, g1);
    await new Promise((r) => setTimeout(r, 5));
    const g2 = gen(u.id, { prompt: "cute 50% pet_egg", visualStyle: "cute-pets" });
    const i2 = image(u.id, g2);

    expect(listCreations(u.id, {}).items.map((i) => i.image.id)).toEqual([i2, i1]);
    expect(listCreations(u.id, { sort: "oldest" }).items.map((i) => i.image.id)).toEqual([i1, i2]);
    expect(listCreations(u.id, { search: "dragon" }).items.map((i) => i.image.id)).toEqual([i1]);
    // LIKE wildcards in the search are matched literally.
    expect(listCreations(u.id, { search: "50%" }).total).toBe(1);
    expect(listCreations(u.id, { search: "_" }).total).toBe(1);
    expect(listCreations(u.id, { style: "cute-pets" }).items.map((i) => i.image.id)).toEqual([i2]);

    setFavorite(u.id, i1, true);
    const favs = listCreations(u.id, { favoritesOnly: true });
    expect(favs.items.map((i) => i.image.id)).toEqual([i1]);
    expect(favs.items[0].image.isFavorite).toBe(true);
    // Image URLs go through the authenticated route, never a storage path.
    expect(favs.items[0].image.url).toBe(`/api/images/${i1}`);
  });

  it("deleting the last image removes the generation too", () => {
    const u = ensureLocalUser();
    const g = gen(u.id);
    const i = image(u.id, g);
    expect(deleteImageForUser(u.id, i)).toBe(`${u.id}/${i}.png`);
    expect(getGenerationForUser(u.id, g)).toBeNull();
  });
});

describe("usage limits", () => {
  it("enforces a member's daily image limit server-side", async () => {
    const u = await member("carl", 3);
    const cfg = getConfig();
    expect(() => assertCanGenerate(u, 2, cfg)).not.toThrow();
    const g = gen(u.id, { imageCount: 2 }); // pending generations count too
    void g;
    expect(() => assertCanGenerate(u, 2, cfg)).toThrowError(/nog 1 afbeelding/);
  });

  it("falls back to DAILY_IMAGE_LIMIT_PER_USER for members, none for admins", async () => {
    process.env.DAILY_IMAGE_LIMIT_PER_USER = "1";
    const m = await member("dana");
    expect(() => assertCanGenerate(m, 2, getConfig())).toThrowError(/limiet/);
    const admin = ensureLocalUser();
    expect(() => assertCanGenerate(admin, 4, getConfig())).not.toThrow();
  });

  it("blocks when the estimated daily spend limit is reached", () => {
    process.env.DAILY_SPEND_LIMIT_USD = "0.05";
    const u = ensureLocalUser();
    recordUsage({ userId: u.id, generationId: null, provider: "openai", model: "gpt-image-2", operation: "image.generate", imageCount: 1, usage: { outputImageTokens: 10_000 } });
    expect(() => assertCanGenerate(u, 1, getConfig())).toThrowError(expect.objectContaining({ code: "spend_limit" }));
  });

  it("limits parallel generations", () => {
    const u = ensureLocalUser();
    gen(u.id);
    gen(u.id);
    expect(() => assertCanGenerate(u, 1, getConfig())).toThrowError(expect.objectContaining({ code: "rate_limited" }));
  });

  it("refuses more images per request than configured", () => {
    process.env.MAX_IMAGES_PER_REQUEST = "2";
    expect(() => assertCanGenerate(ensureLocalUser(), 4, getConfig())).toThrowError(/Maximaal 2/);
  });

  it("rate limits bursts per key", () => {
    checkRateLimit("k", 2, 60_000, 1000);
    checkRateLimit("k", 2, 60_000, 1001);
    expect(() => checkRateLimit("k", 2, 60_000, 1002)).toThrowError(expect.objectContaining({ code: "rate_limited" }));
    expect(() => checkRateLimit("k", 2, 60_000, 70_000)).not.toThrow();
  });
});

function task(provider: ReturnType<typeof fakeProvider>, overrides: Partial<GenerationTask> = {}): GenerationTask {
  return {
    userId: ensureLocalUser().id,
    kind: "generate",
    provider,
    prompt: "nugget king",
    enhancedPrompt: null,
    finalPrompt: "nugget king, full prompt",
    aspectRatio: "16:9",
    style: "boss-fight",
    quality: "standard",
    count: 2,
    overlay: null,
    source: null,
    ...overrides,
  };
}

describe("generation pipeline", () => {
  it("stores real images at the exact output size and records estimated usage", async () => {
    const provider = fakeProvider({});
    let job: (() => Promise<void>) | null = null;
    const id = startGeneration(task(provider), (fn) => (job = fn));
    const u = ensureLocalUser();
    expect(getGenerationForUser(u.id, id)?.status).toBe("pending");
    await job!();

    const g = getGenerationForUser(u.id, id)!;
    expect(g.status).toBe("succeeded");
    expect(g.providerQuality).toBe("medium");
    expect(g.images).toHaveLength(2);
    for (const img of g.images) {
      expect([img.width, img.height]).toEqual([1920, 1080]);
      const rec = getImageForUser(u.id, img.id)!;
      const meta = await sharp(fs.readFileSync(path.join(dataDir, "images", rec.storagePath))).metadata();
      expect([meta.width, meta.height]).toEqual([1920, 1080]);
    }
    const usage = getUsageSummary({ userId: u.id, all: false });
    expect(usage.today.images).toBe(2);
    expect(usage.recent[0].costStatus).toBe("estimated");
    expect(usage.recent[0].costUsd).toBeGreaterThan(0);
  });

  it("adds a separate image with the text overlay and keeps the original", async () => {
    const provider = fakeProvider({});
    const u = ensureLocalUser();
    let job: (() => Promise<void>) | null = null;
    const id = startGeneration(task(provider, { count: 1, overlay: { ...DEFAULT_OVERLAY, text: "EPIC BOSS!" } }), (fn) => (job = fn));
    await job!();
    const g = getGenerationForUser(u.id, id)!;
    expect(g.images).toHaveLength(2);
    const original = g.images.find((i) => !i.overlay)!;
    const withText = g.images.find((i) => i.overlay)!;
    expect(withText.parentImageId).toBe(original.id);
    expect(withText.overlay?.text).toBe("EPIC BOSS!");
    // The overlay copy differs from the original pixels.
    const a = await readImageFile(getImageForUser(u.id, original.id)!.storagePath);
    const b = await readImageFile(getImageForUser(u.id, withText.id)!.storagePath);
    expect(a.equals(b)).toBe(false);
  });

  it("marks failed jobs as failed with a readable message and records no usage", async () => {
    const { AppError } = await import("@/lib/ai/errors");
    const provider = fakeProvider({ fail: new AppError("provider_quota", "Je tegoed bij OpenAI is op.") });
    const u = ensureLocalUser();
    const t = task(provider);
    const id = startGeneration(t, () => undefined);
    await runGeneration(id, t);
    const g = getGenerationForUser(u.id, id)!;
    expect(g.status).toBe("failed");
    expect(g.errorCode).toBe("provider_quota");
    expect(g.errorMessage).toContain("tegoed");
    expect(g.images).toHaveLength(0);
    expect(getUsageSummary({ userId: u.id, all: false }).today.requests).toBe(0);
  });

  it("fails cleanly when the provider returns bytes that are not an image", async () => {
    const provider = fakeProvider({
      result: async () => ({ images: [{ data: Buffer.from("not an image"), mimeType: "image/png" }], usage: null, providerQuality: "medium", model: "gpt-image-2" }),
    });
    const u = ensureLocalUser();
    const t = task(provider, { count: 1 });
    const id = startGeneration(t, () => undefined);
    await runGeneration(id, t);
    const g = getGenerationForUser(u.id, id)!;
    expect(g.status).toBe("failed");
    // The provider did return something, so the user is told it may be billed.
    expect(g.errorMessage).toContain("gefactureerd");
  });
});
