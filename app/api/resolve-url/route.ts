import { NextRequest, NextResponse } from "next/server"

function extractCoords(text: string): { lat: number; lng: number } | null {
  // @lat,lng
  // !3d<lat>!4d<lng> (most precise, from data param)
  const dataMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (dataMatch) return { lat: parseFloat(dataMatch[1]), lng: parseFloat(dataMatch[2]) }
  // @lat,lng
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) }
  // ?q=lat,lng or &q=lat,lng
  const qMatch = text.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) }
  // ll=lat,lng
  const llMatch = text.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) }
  // center=lat,lng (sometimes used in embeds)
  const centerMatch = text.match(/center=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (centerMatch) return { lat: parseFloat(centerMatch[1]), lng: parseFloat(centerMatch[2]) }
  return null
}

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
    const res = await fetch(url.trim(), { redirect: "follow" })
    const finalUrl = res.url

    // First try extracting coords from the final URL
    const urlCoords = extractCoords(finalUrl)
    if (urlCoords) {
      return NextResponse.json({ resolved: finalUrl, coords: urlCoords })
    }

    // If URL didn't have coords, try extracting from response body
    const body = await res.text()
    const bodyCoords = extractCoords(body)
    if (bodyCoords) {
      return NextResponse.json({ resolved: finalUrl, coords: bodyCoords })
    }

    return NextResponse.json({ resolved: finalUrl })
  } catch {
    return NextResponse.json({ error: "Failed to resolve URL" }, { status: 502 })
  }
}
