import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { errorResponse } from "@/lib/http";
import { getUsageSummary } from "@/lib/usage/records";

/** Admins see totals for everyone (they pay the bill); members see their own. */
export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(getUsageSummary({ userId: user.id, all: user.role === "admin" }));
  } catch (err) {
    return errorResponse(err);
  }
}
