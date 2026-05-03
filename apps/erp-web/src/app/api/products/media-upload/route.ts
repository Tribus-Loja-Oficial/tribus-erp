import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { env } from "@/lib/config/env";
import type { UploadedProductMediaRow } from "@/lib/product-media-types";

const MAX_BYTES = 5 * 1024 * 1024;

type ApiJson = {
  message?: string;
  code?: string;
  data?: UploadedProductMediaRow;
  issues?: Array<{ path?: (string | number)[]; message?: string }>;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Inicia sessão para enviar imagens." }, { status: 401 });
  }

  let body: FormData;
  try {
    body = await request.formData();
  } catch {
    return NextResponse.json(
      {
        message:
          "Não foi possível ler o ficheiro (pedido multipart inválido ou excede o limite de tamanho do servidor / Vercel). Tenta uma imagem mais pequena.",
      },
      { status: 400 },
    );
  }

  const file = body.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Falta o campo de ficheiro (`file`)." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    return NextResponse.json(
      {
        message: `Esta imagem tem ${mb} MB. O limite é 5 MB por ficheiro (definido na API Tribus ERP).`,
      },
      { status: 400 },
    );
  }

  const productId = body.get("productId");
  const outbound = new FormData();
  outbound.append("file", file);
  if (typeof productId === "string" && productId.trim()) {
    outbound.append("productId", productId.trim());
  }

  const res = await fetch(`${env.erpApiUrl}/products/media/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.erpApiInternalSecret}`,
    },
    body: outbound,
  });

  const raw = await res.text();
  let json: ApiJson;
  try {
    json = JSON.parse(raw) as ApiJson;
  } catch {
    return NextResponse.json(
      {
        message: `A API devolveu uma resposta inválida (HTTP ${res.status}). Se o ficheiro é grande, pode ser limite da infraestrutura.`,
      },
      { status: 502 },
    );
  }

  if (!res.ok) {
    if (json.code === "VALIDATION_ERROR" && Array.isArray(json.issues) && json.issues.length > 0) {
      const first = json.issues[0]!;
      const path = first.path?.length ? first.path.join(".") : "";
      const detail = [path, first.message].filter(Boolean).join(": ");
      return NextResponse.json(
        { message: detail || json.message || "Erro de validação na API.", code: json.code },
        { status: res.status },
      );
    }
    return NextResponse.json(
      {
        message:
          json.message ??
          (res.status === 413
            ? "Ficheiro demasiado grande para o limite da rede ou do servidor intermédio."
            : `Upload recusado (HTTP ${res.status}).`),
        code: json.code,
      },
      { status: res.status },
    );
  }

  if (!json.data) {
    return NextResponse.json(
      { message: "A API não devolveu dados do ficheiro criado." },
      { status: 502 },
    );
  }

  return NextResponse.json({ data: json.data }, { status: 201 });
}
