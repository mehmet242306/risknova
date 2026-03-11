import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth", "1", { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
