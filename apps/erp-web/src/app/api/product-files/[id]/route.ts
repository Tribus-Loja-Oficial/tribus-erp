import { auth } from "@/lib/auth/config";
import { env } from "@/lib/config/env";

const FILE_ID_RE = /^file_[a-f0-9]{32}$/i;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const decoded = decodeURIComponent(id);
  if (!FILE_ID_RE.test(decoded)) {
    return new Response("Bad Request", { status: 400 });
  }

  const upstream = await fetch(
    `${env.erpApiUrl}/products/document-files/${encodeURIComponent(decoded)}/stream`,
    {
      headers: {
        Authorization: `Bearer ${env.erpApiInternalSecret}`,
      },
    },
  );

  if (!upstream.ok) {
    return new Response(upstream.statusText, { status: upstream.status });
  }

  const contentType = upstream.headers.get("Content-Type") ?? "application/octet-stream";
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
