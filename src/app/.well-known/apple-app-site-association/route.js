import { NextResponse } from 'next/server';

export async function GET() {
  const appleAppSiteAssociation = {
    applinks: {
      apps: [],
      details: [
        {
          appID: "J9UZJV4K79.org.reactjs.native.example.WinterAcademyNew",
          paths: [
            "/profile/*"
          ]
        }
      ]
    }
  };

  return new NextResponse(JSON.stringify(appleAppSiteAssociation), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
