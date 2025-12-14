import { NextResponse } from 'next/server';

export async function GET() {
  const assetlinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        package_name: "com.wintermate.app",
        sha256_cert_fingerprints: [
          "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C",
          "CA:5D:7B:1E:9C:C8:D2:35:E5:9B:6E:2C:AF:6E:B3:45:81:DF:A2:36:5B:83:BA:E1:A3:80:5A:4B:01:F3:DC:7F"
        ]
      }
    }
  ];

  return new NextResponse(JSON.stringify(assetlinks), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
