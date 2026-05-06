import { NextResponse } from "next/server";
import { assertAdminApiSession } from "@/lib/server/assert-admin-api";
import { upstreamIngestionJob } from "@/lib/server/erp-ingestion-upstream";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await assertAdminApiSession();
  } catch (e) {
    const status =
      e instanceof Error && "status" in e ? (e as Error & { status: number }).status : 500;
    const message = e instanceof Error ? e.message : "Erro de autorização";
    return NextResponse.json({ message }, { status });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ message: "ID inválido" }, { status: 400 });
  }

  const upstream = await upstreamIngestionJob(id);
  const rawText = await upstream.text();

  return new NextResponse(rawText || "{}", {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
