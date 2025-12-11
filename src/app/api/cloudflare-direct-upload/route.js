// app/api/cloudflare-direct-upload/route.js
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { filename, size, type } = await request.json();

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
    const customerDomain =  "customer-u3x9n6q7oawrn63f.cloudflarestream.com"

    if (!accountId || !apiToken) {
      console.error("Missing Cloudflare env vars");
      return new NextResponse(
        JSON.stringify({ error: "Missing Cloudflare config" }),
        { status: 500 }
      );
    }

    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        // Champ obligatoire selon l’erreur Cloudflare (code 10005)
        body: JSON.stringify({
          maxDurationSeconds: 600, // par exemple 10 minutes, tu pourras ajuster
          requireSignedURLs: false,
        }),
      }
    );

    const rawText = await cfRes.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }

    if (!cfRes.ok || !data?.success) {
      console.error("Cloudflare error status:", cfRes.status);
      console.error("Cloudflare raw response:", rawText);
      return new NextResponse(
        JSON.stringify({ error: "Cloudflare direct upload failed" }),
        { status: 500 }
      );
    }

    const { uploadURL, uid } = data.result;

    // Si tu as un domaine "customer-xxxxx.cloudflarestream.com", configure-le dans
    // CLOUDFLARE_STREAM_CUSTOMER_DOMAIN (ex: "customer-u3x9n6q7oawrn63f.cloudflarestream.com")
    const hlsBase = customerDomain
      ? `https://${customerDomain}`
      : "https://videodelivery.net";

    const playback = {
      hls: `${hlsBase}/${uid}/manifest/video.m3u8`,
    };

    // La miniature n'est pas toujours dispo immédiatement, donc on la renvoie si elle existe
    const thumbnail = data.result.thumbnail || null;

    return NextResponse.json({
      uploadURL,
      uid,
      playback,
      thumbnail,
    });
  } catch (err) {
    console.error("Direct upload route error:", err);
    return new NextResponse(
      JSON.stringify({ error: "Unexpected error" }),
      { status: 500 }
    );
  }
}