"use client";

import { useCallback, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, CheckCircle2, FileJson2, Loader2, WandSparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  executeIngestionAction,
  validateIngestionAction,
  type IngestionExecuteResponse,
  type IngestionValidationResponse,
} from "@/server/ingestion-actions";

type Step = "edit" | "validated" | "result";

const DEFAULT_PAYLOAD = `{
  "version": "1.0",
  "mode": "create",
  "objects": [
    {
      "type": "product",
      "client_ref": "demo_produto",
      "data": {
        "sku": "INGEST-DEMO-001",
        "name": "Produto demonstração (ingestão)",
        "productType": "finished_product",
        "salePriceCents": 1990,
        "costPriceCents": 800,
        "status": "draft"
      }
    }
  ]
}`;

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function IngestionModal() {
  const [open, setOpen] = useState(false);
  const [jsonText, setJsonText] = useState(DEFAULT_PAYLOAD);
  const [step, setStep] = useState<Step>("edit");
  const [validation, setValidation] = useState<IngestionValidationResponse["data"] | null>(null);
  const [executeResult, setExecuteResult] = useState<IngestionExecuteResponse["data"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("edit");
    setValidation(null);
    setExecuteResult(null);
    setError(null);
    setJsonText(DEFAULT_PAYLOAD);
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      reset();
    }
  };

  const parseBody = (): unknown => {
    const trimmed = jsonText.trim();
    if (!trimmed) throw new Error("Introduza um JSON.");
    return JSON.parse(trimmed) as unknown;
  };

  const handleValidate = async () => {
    setError(null);
    setBusy(true);
    try {
      const body = parseBody();
      const res = await validateIngestionAction(body);
      setValidation(res.data);
      setStep("validated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao validar");
      setStep("edit");
    } finally {
      setBusy(false);
    }
  };

  const handleExecute = async () => {
    setError(null);
    setBusy(true);
    try {
      const body = parseBody();
      const res = await executeIngestionAction(body);
      setExecuteResult(res.data);
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao executar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-600 transition-colors",
            "hover:bg-zinc-50 hover:text-zinc-900",
          )}
        >
          <FileJson2 className="h-4 w-4 shrink-0" />
          Ingestão JSON
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-zinc-950/40" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[min(100vw-2rem,720px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-zinc-200 bg-white shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <WandSparkles className="h-5 w-5 text-violet-600" />
              <Dialog.Title className="text-base font-semibold text-zinc-900">
                Ingestão estruturada
              </Dialog.Title>
            </div>
            <Dialog.Close
              className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            Cole um payload JSON com version 1.0, mode create e objects. Valide antes de executar.
          </Dialog.Description>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
            {step !== "result" && (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500">Payload JSON</span>
                  <button
                    type="button"
                    className="text-xs font-medium text-violet-700 hover:underline"
                    onClick={() => setJsonText((t) => formatJson(t))}
                  >
                    Formatar
                  </button>
                </div>
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  spellCheck={false}
                  className="min-h-[220px] flex-1 resize-y rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 font-mono text-xs leading-relaxed text-zinc-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
                  disabled={busy}
                />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === "validated" && validation && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {validation.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium text-zinc-800">
                    {validation.valid ? "Payload válido" : "Corrija os erros antes de executar"}
                  </span>
                </div>
                {validation.errors.length > 0 && (
                  <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-red-700">
                    {validation.errors.map((err, i) => (
                      <li key={i}>
                        {err.objectIndex != null ? `#${err.objectIndex + 1} ` : ""}
                        {err.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {step === "result" && executeResult && (
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <p className="font-medium text-zinc-800">
                  Concluído: {executeResult.created} criado(s), {executeResult.failed} falha(s) —
                  total {executeResult.total}
                </p>
                <ul className="space-y-2 text-xs">
                  {executeResult.items.map((item) => (
                    <li
                      key={item.index}
                      className={cn(
                        "rounded-md border px-2 py-1.5",
                        item.status === "created"
                          ? "border-emerald-200 bg-emerald-50/80"
                          : "border-red-200 bg-red-50/80",
                      )}
                    >
                      <span className="font-mono text-zinc-600">[{item.index}]</span> {item.type}{" "}
                      {item.status === "created" ? (
                        <span className="text-emerald-800">→ {item.id}</span>
                      ) : (
                        <span className="text-red-800">{item.error}</span>
                      )}
                      {item.warnings?.length ? (
                        <div className="mt-1 text-amber-800">
                          {item.warnings.map((w, j) => (
                            <div key={j}>{w}</div>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {Object.keys(executeResult.refMap).length > 0 && (
                  <pre className="mt-2 overflow-x-auto rounded bg-zinc-900/90 p-2 font-mono text-[10px] text-zinc-100">
                    {JSON.stringify(executeResult.refMap, null, 2)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 pt-3">
              {step === "result" && (
                <button
                  type="button"
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  onClick={() => {
                    setStep("edit");
                    setExecuteResult(null);
                    setValidation(null);
                  }}
                >
                  Novo payload
                </button>
              )}
              {step === "edit" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleValidate()}
                  className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Validar
                </button>
              )}
              {step === "validated" && validation?.valid && (
                <>
                  <button
                    type="button"
                    className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    onClick={() => {
                      setStep("edit");
                      setValidation(null);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleExecute()}
                    className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Executar
                  </button>
                </>
              )}
              {step === "validated" && !validation?.valid && (
                <button
                  type="button"
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  onClick={() => {
                    setStep("edit");
                    setValidation(null);
                  }}
                >
                  Voltar a editar
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
