import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { buildAppStatus } from "@/lib/services";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json(buildAppStatus(user));
  } catch (err) {
    return errorResponse(err);
  }
}
