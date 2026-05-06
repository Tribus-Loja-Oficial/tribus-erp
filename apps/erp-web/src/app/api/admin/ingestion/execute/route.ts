import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { assertAdminApiSession } from "@/lib/server/assert-admin-api";
import {
  upstreamIngestionEnqueue,
  upstreamIngestionExecute,
} from "@/lib/server/erp-ingestion-upstream";
import { shouldEnqueueIngestionAsync } from "@/lib/ingestion-sync-thresholds";

/**
 * Modo síncrono: espera pelo Worker até ao fim (limitado pelo plano Vercel — Hobby ~60s).
 * Modo assíncrono: payloads grandes são enfileirados no Worker (`INGESTION_QUEUE`); resposta 202 + jobId.
 *
 * @see https://vercel.com/docs/functions/configuring-functions/duration
 */
export const maxDuration = 300;
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Corpo JSON inválido ou em falta." }, { status: 400 });
  }

  const useAsync = shouldEnqueueIngestionAsync(payload);
  const upstream = useAsync
    ? await upstreamIngestionEnqueue(payload)
    : await upstreamIngestionExecute(payload);
  const rawText = await upstream.text();

  if (upstream.status === 200 || upstream.status === 207 || upstream.status === 422) {
    revalidatePath("/products");
    revalidatePath("/customers");
    revalidatePath("/suppliers");
    revalidatePath("/inventory");
    revalidatePath("/orders");
    revalidatePath("/purchases");
  }

  return new NextResponse(rawText || "{}", {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json",
      ...(useAsync && upstream.status === 202 ? { "X-Ingestion-Mode": "async" } : {}),
    },
  });
}
