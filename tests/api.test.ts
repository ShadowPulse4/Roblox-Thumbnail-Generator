import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestEnv, fakeProvider, makePng } from "./helpers/env";

/**
 * Calls the real route handlers. `after()` is replaced so background work can
 * be awaited, and the image provider is replaced with a test double so no
 * paid API is called.
 */
const scheduled: (() => Promise<void>)[] = [];
vi.mock("next/server", async (orig) => {
  const actual = await orig<typeof import("next/server")>();
  return { ...actual, after: (fn: () => Promise<void>) => scheduled.push(fn) };
});

const providerRef: { current: ReturnType<typeof fakeProvider> | null } = { current: null };
vi.mock("@/lib/services", async (orig) => {
  const actual = await orig<typeof import("@/lib/services")>();
  return {
    ...actual,
    getImageProvider: () => providerRef.current ?? actual.getImageProvider(),
  };
});

const { POST: generate } = await import("@/app/api/generate/route");
const { POST: edit } = await import("@/app/api/edit/route");
const { POST: overlay } = await import("@/app/api/overlay/route");
const { GET: getGeneration } = await import("@/app/api/generations/[id]/route");
const { GET: getImage } = await import("@/app/api/images/[id]/route");
const { GET: status } = await import("@/app/api/status/route");

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    body: JSON.stringify(body),
  });
}

const valid = { prompt: "an epic nugget king", aspectRatio: "16:9", style: "boss-fight", quality: "standard", count: 1 };

beforeEach(() => {
  setupTestEnv();
  scheduled.length = 0;
  providerRef.current = null;
});

async function runScheduled() {
  while (scheduled.length) await scheduled.shift()!();
}

describe("POST /api/generate", () => {
  it("returns a setup error, not a fake image, when no key is configured", async () => {
    const res = await generate(post(valid));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("not_configured");
    expect(body.error.message).toContain("OPENAI_API_KEY");
  });

  it("validates input on the server", async () => {
    providerRef.current = fakeProvider({});
    const res = await generate(post({ ...valid, prompt: "" }));
    expect(res.status).toBe(400);
    const res2 = await generate(post({ ...valid, count: 50 }));
    expect(res2.status).toBe(400);
  });

  it("rejects cross-site requests", async () => {
    providerRef.current = fakeProvider({});
    const res = await generate(post(valid, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("blocks paid calls on an open production install", async () => {
    vi.stubEnv("NODE_ENV", "production");
    providerRef.current = fakeProvider({});
    const res = await generate(post(valid));
    vi.unstubAllEnvs();
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("open_access_blocked");
  });

  it("requires login when accounts are enabled", async () => {
    process.env.AUTH_MODE = "local";
    vi.doMock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
    vi.resetModules();
    const { POST } = await import("@/app/api/generate/route");
    const res = await POST(post(valid));
    vi.doUnmock("next/headers");
    expect(res.status).toBe(401);
  });

  it("runs the full flow: 202, poll, image served with download name", async () => {
    providerRef.current = fakeProvider({});
    const res = await generate(post({ ...valid, count: 2 }));
    expect(res.status).toBe(202);
    const { generationId } = await res.json();
    expect(providerRef.current.calls).toHaveLength(0); // runs after the response
    await runScheduled();
    expect(providerRef.current.calls[0].prompt.startsWith("an epic nugget king")).toBe(true);

    const genRes = await getGeneration(new Request("http://x") as never, { params: Promise.resolve({ id: generationId }) } as never);
    const gen = await genRes.json();
    expect(gen.status).toBe("succeeded");
    expect(gen.images).toHaveLength(2);
    // Contract: the fields the frontend reads are present.
    for (const key of ["id", "kind", "prompt", "finalPrompt", "aspectRatio", "visualStyle", "imageModel", "providerQuality", "status", "images"]) {
      expect(gen).toHaveProperty(key);
    }
    expect(gen.images[0]).toMatchObject({ width: 1920, height: 1080, url: expect.stringMatching(/^\/api\/images\//) });

    const { NextRequest } = await import("next/server");
    const imgRes = await getImage(new NextRequest(`http://x${gen.images[0].url}?download=1`), { params: Promise.resolve({ id: gen.images[0].id }) } as never);
    expect(imgRes.status).toBe(200);
    expect(imgRes.headers.get("content-type")).toBe("image/png");
    expect(imgRes.headers.get("content-disposition")).toMatch(/attachment; filename="roblox-thumbnail-\d{4}-\d{2}-\d{2}-[a-z0-9]{6}\.png"/);
  });

  it("reports provider failures through the generation status", async () => {
    const { AppError } = await import("@/lib/ai/errors");
    providerRef.current = fakeProvider({ fail: new AppError("provider_rate_limited", "OpenAI krijgt te veel verzoeken.") });
    const { generationId } = await (await generate(post(valid))).json();
    await runScheduled();
    const gen = await (await getGeneration(new Request("http://x") as never, { params: Promise.resolve({ id: generationId }) } as never)).json();
    expect(gen.status).toBe("failed");
    expect(gen.errorCode).toBe("provider_rate_limited");
  });
});

describe("edit and overlay", () => {
  it("edits an existing image into a new one and keeps the original", async () => {
    providerRef.current = fakeProvider({});
    const { generationId } = await (await generate(post(valid))).json();
    await runScheduled();
    const first = await (await getGeneration(new Request("http://x") as never, { params: Promise.resolve({ id: generationId }) } as never)).json();
    const sourceId = first.images[0].id;

    const res = await edit(post({ imageId: sourceId, instruction: "Change the background to purple", quality: "standard" }));
    expect(res.status).toBe(202);
    const { generationId: editId } = await res.json();
    await runScheduled();
    expect(providerRef.current.calls.at(-1)?.method).toBe("edit");
    const edited = await (await getGeneration(new Request("http://x") as never, { params: Promise.resolve({ id: editId }) } as never)).json();
    expect(edited.kind).toBe("edit");
    expect(edited.images[0].parentImageId).toBe(sourceId);
    // The original is still there.
    const { NextRequest } = await import("next/server");
    const orig = await getImage(new NextRequest(`http://x/api/images/${sourceId}`), { params: Promise.resolve({ id: sourceId }) } as never);
    expect(orig.status).toBe(200);
  });

  it("returns 404 when editing an image that does not exist", async () => {
    providerRef.current = fakeProvider({});
    const res = await edit(post({ imageId: crypto.randomUUID(), instruction: "make it purple", quality: "standard" }));
    expect(res.status).toBe(404);
  });

  it("renders a text overlay locally as a new image", async () => {
    providerRef.current = fakeProvider({ result: async () => ({ images: [{ data: await makePng(1920, 1088), mimeType: "image/png" }], usage: null, providerQuality: "medium", model: "gpt-image-2" }) });
    const { generationId } = await (await generate(post(valid))).json();
    await runScheduled();
    const g = await (await getGeneration(new Request("http://x") as never, { params: Promise.resolve({ id: generationId }) } as never)).json();
    const res = await overlay(
      post({
        imageId: g.images[0].id,
        overlay: { text: "NEW UPDATE!", font: "luckiest-guy", sizePercent: 14, position: "top", fillColor: "#FFD23F", outlineColor: "#1A1033", outlinePercent: 12, rotation: -4 },
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.image.overlay.text).toBe("NEW UPDATE!");
    expect(body.image.parentImageId).toBe(g.images[0].id);
  });

  it("refuses overlay text the font cannot draw instead of rendering boxes", async () => {
    providerRef.current = fakeProvider({});
    const { generationId } = await (await generate(post(valid))).json();
    await runScheduled();
    const g = await (await getGeneration(new Request("http://x") as never, { params: Promise.resolve({ id: generationId }) } as never)).json();
    const res = await overlay(
      post({
        imageId: g.images[0].id,
        overlay: { text: "火 BOSS", font: "anton", sizePercent: 14, position: "top", fillColor: "#FFFFFF", outlineColor: "#000000", outlinePercent: 10, rotation: 0 },
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain("火");
  });
});

describe("GET /api/status", () => {
  it("never exposes secrets", async () => {
    process.env.OPENAI_API_KEY = "sk-secret-value-123";
    process.env.ANTHROPIC_API_KEY = "sk-ant-secret-456";
    const body = JSON.stringify(await (await status()).json());
    expect(body).not.toContain("sk-secret");
    expect(body).not.toContain("sk-ant");
    expect(JSON.parse(body).image.configured).toBe(true);
    expect(JSON.parse(body).text.configured).toBe(true);
  });
});
