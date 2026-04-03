import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 })
  }

  // Only allow resolving known Google Maps short URLs
  if (!/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(url.trim())) {
    return NextResponse.json({ error: "Not a Google Maps short URL" }, { status: 400 })
  }

  try {
    // Follow redirects manually to get the final URL
    const res = await fetch(url.trim(), { redirect: "follow" })
    return NextResponse.json({ resolved: res.url })
  } catch {
    return NextResponse.json({ error: "Failed to resolve URL" }, { status: 502 })
  }
}
