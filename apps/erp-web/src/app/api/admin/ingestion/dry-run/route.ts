import { NextResponse } from "next/server";
import { assertAdminApiSession } from "@/lib/server/assert-admin-api";
import { upstreamIngestionDryRun } from "@/lib/server/erp-ingestion-upstream";

/** Dry-run com payloads grandes pode demorar mais que um Server Action permite. */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await assertAdminApiSession();
  } catch (e) {
    const status =
      e instanceof Error && "status" in e ? (e as Error & { status: number }).status : 500;
    const message = e instanceof Error ? e.message : "Erro de autorização";
    return NextResponse.json({ message }, { status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Corpo JSON inválido ou em falta." }, { status: 400 });
  }

  const upstream = await upstreamIngestionDryRun(body);
  const rawText = await upstream.text();

  return new NextResponse(rawText || "{}", {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
