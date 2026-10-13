import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth/session";
import { assertSameOrigin, errorResponse } from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await endSession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
