"use client";

import { useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileJson2,
  Loader2,
  Package,
  RefreshCw,
  WandSparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  validateIngestionAction,
  revalidateAfterIngestionAction,
  type IngestionDryRunResponse,
  type IngestionExecuteResponse,
  type IngestionValidationResponse,
} from "@/server/ingestion-actions";
import {
  fetchAdminIngestionJob,
  postAdminIngestionExecute,
  postAdminIngestionJson,
  type IngestionJobStatusPayload,
} from "@/lib/ingestion-admin-fetch";
import { INGESTION_TEMPLATES } from "@/features/ingestion/lib/ingestion-templates";
import { IngestionFieldReferencePanel } from "@/features/ingestion/components/ingestion-field-reference-panel";
import { INGESTION_TYPE_LABELS_UI } from "@/features/ingestion/lib/ingestion-field-reference";
import { ingestionSupportedTypesFooter } from "@/features/ingestion/lib/ingestion-field-reference";

type Step = "edit" | "validated" | "result";

export const INGESTION_DEFAULT_JSON = `{
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

function parseJsonSafe(text: string): { ok: boolean; error: string | null } {
  if (!text.trim()) return { ok: false, error: null };
  try {
    JSON.parse(text);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof SyntaxError ? e.message : "JSON inválido" };
  }
}

function ValidationPanel({ result }: { result: IngestionValidationResponse["data"] }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border px-3 py-2.5",
          result.valid ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60",
        )}
      >
        {result.valid ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
        )}
        <div>
          <p className="text-sm font-medium text-zinc-900">
            {result.valid ? "Payload válido" : "Corrija os erros"}
          </p>
          <p className="text-xs text-zinc-600">
            {result.summary.total} objeto(s) · tipos:{" "}
            {Object.entries(result.summary.byType)
              .map(([k, n]) => {
                const label =
                  INGESTION_TYPE_LABELS_UI[k as keyof typeof INGESTION_TYPE_LABELS_UI] ?? k;
                return `${label} (${n})`;
              })
              .join(", ")}
          </p>
        </div>
      </div>
      {result.errors.length > 0 && (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto text-xs text-red-800">
          {result.errors.map((err, i) => (
            <li key={i} className="rounded border border-red-100 bg-white/80 px-2 py-1.5">
              {err.objectIndex != null ? `Objeto #${err.objectIndex + 1} ` : ""}
              {err.message}
              {err.field ? (
                <span className="mt-0.5 block font-mono text-[10px] text-red-600">{err.field}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {result.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-900">
          {result.warnings.map((w, i) => (
            <li key={i}>{w.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DryRunPanel({ result }: { result: IngestionDryRunResponse["data"] }) {
  const ok = result.valid && result.planned.failed === 0;
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4">
      <p className="text-xs font-semibold text-zinc-800">Simulação (dry-run)</p>
      {!result.valid && result.errors.length > 0 && (
        <ul className="max-h-36 space-y-1.5 overflow-y-auto text-xs text-red-800">
          {result.errors.map((err, i) => (
            <li key={i} className="rounded border border-red-100 bg-white/80 px-2 py-1.5">
              {"message" in err ? err.message : String(err)}
            </li>
          ))}
        </ul>
      )}
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border px-3 py-2.5",
          ok ? "border-sky-200 bg-sky-50/60" : "border-amber-200 bg-amber-50/60",
        )}
      >
        {ok ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-sky-600" />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
        )}
        <div>
          <p className="text-sm font-medium text-zinc-900">
            {ok ? "Plano previsto sem erros" : "Plano com falhas previstas"}
          </p>
          <p className="text-xs text-zinc-600">
            {result.planned.created} criado(s), {result.planned.updated} atualizado(s),{" "}
            {result.planned.skipped} ignorado(s), {result.planned.failed} falha(s) prevista(s)
          </p>
        </div>
      </div>
      <p className="text-[10px] leading-snug text-zinc-500">
        Nada foi gravado na base. IDs em <span className="font-mono">refMap</span> podem ser
        marcadores <span className="font-mono">dry-run:…</span> para objetos novos.
      </p>
      <ul className="max-h-[min(28vh,240px)] space-y-1.5 overflow-y-auto text-xs">
        {result.items.map((item) => (
          <li
            key={`dry-${item.index}`}
            className={cn(
              "rounded-md border px-2 py-1.5",
              item.plannedStatus === "created" && "border-emerald-200 bg-emerald-50/50",
              item.plannedStatus === "updated" && "border-blue-200 bg-blue-50/50",
              item.plannedStatus === "skipped" && "border-zinc-200 bg-zinc-50/50",
              item.plannedStatus === "failed" && "border-red-200 bg-red-50/50",
            )}
          >
            <span className="font-mono text-zinc-500">[{item.index}]</span>{" "}
            {INGESTION_TYPE_LABELS_UI[item.type as keyof typeof INGESTION_TYPE_LABELS_UI] ??
              item.type}{" "}
            {item.clientRef ? (
              <span className="font-mono text-[10px] text-zinc-500"> ref:{item.clientRef}</span>
            ) : null}
            <span className="block text-[10px] tracking-wide text-zinc-500 uppercase">
              {item.plannedStatus === "created" && "Seria criado"}
              {item.plannedStatus === "updated" && "Seria atualizado"}
              {item.plannedStatus === "skipped" && "Seria ignorado (já existe)"}
              {item.plannedStatus === "failed" && "Falharia"}
            </span>
            {item.detail ? <span className="block text-red-800">{item.detail}</span> : null}
          </li>
        ))}
      </ul>
      {Object.keys(result.refMap).length > 0 && (
        <pre className="max-h-24 overflow-auto rounded bg-zinc-900 p-2 font-mono text-[10px] text-zinc-100">
          {JSON.stringify(result.refMap, null, 2)}
        </pre>
      )}
    </div>
  );
}

function AsyncIngestionJobPanel({
  jobId,
  snapshot,
  manualPending,
  onRefresh,
}: {
  jobId: string;
  snapshot: IngestionJobStatusPayload | null;
  manualPending: boolean;
  onRefresh: () => void;
}) {
  const pct =
    snapshot && snapshot.progress.total > 0
      ? Math.min(100, Math.round((snapshot.progress.processed / snapshot.progress.total) * 100))
      : 0;
  const label =
    snapshot?.status === "queued"
      ? "Na fila…"
      : snapshot?.status === "running"
        ? "Processando…"
        : snapshot?.status === "completed"
          ? "Concluído"
          : snapshot?.status === "failed"
            ? "Falhou"
            : "Iniciando…";

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-violet-200 bg-violet-50/40 px-1 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-violet-900">Ingestão em segundo plano</p>
        <button
          type="button"
          disabled={manualPending}
          onClick={() => onRefresh()}
          className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-white px-2 py-1 text-[11px] font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
        >
          {manualPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Atualizar status
        </button>
      </div>
      <p className="font-mono text-[10px] text-zinc-600">
        job: <span className="text-zinc-900">{jobId}</span>
      </p>
      <p className="text-xs text-zinc-700">{label}</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full bg-violet-600 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-zinc-600">
        {snapshot ? `${snapshot.progress.processed} / ${snapshot.progress.total} objetos` : "…"}
      </p>
      {snapshot?.updatedAt ? (
        <p className="text-[10px] text-zinc-500">Última atualização: {snapshot.updatedAt}</p>
      ) : null}
    </div>
  );
}

function ResultPanel({ result }: { result: IngestionExecuteResponse["data"] }) {
  const ok = result.failed === 0;
  const totalFail =
    result.created === 0 && (result.updated ?? 0) === 0 && (result.skipped ?? 0) === 0;
  const [showSuccessItems, setShowSuccessItems] = useState(false);
  const issueItems = result.items.filter(
    (item) => item.status === "failed" || item.warnings?.length,
  );
  const successItems = result.items.filter(
    (item) => item.status !== "failed" && (!item.warnings || item.warnings.length === 0),
  );
  return (
    <div className="flex h-full flex-col gap-3">
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border px-3 py-2.5",
          ok && "border-emerald-200 bg-emerald-50/60",
          !ok && !totalFail && "border-amber-200 bg-amber-50/50",
          totalFail && result.failed > 0 && "border-red-200 bg-red-50/60",
        )}
      >
        {ok ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
        )}
        <div>
          <p className="text-sm font-medium text-zinc-900">
            {ok
              ? "Ingestão concluída"
              : totalFail
                ? "Nenhum objeto processado"
                : "Ingestão parcial"}
          </p>
          <p className="text-xs text-zinc-600">
            {result.created} criado(s)
            {(result.updated ?? 0) > 0 && `, ${result.updated} atualizado(s)`}
            {(result.skipped ?? 0) > 0 && `, ${result.skipped} ignorado(s)`}
            {result.failed > 0 && `, ${result.failed} falha(s)`}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50/40 px-2 py-1.5">
          <p className="text-xs font-semibold text-amber-900">
            Atenção ({issueItems.length}) · warnings e erros
          </p>
        </div>
        <ul className="max-h-[min(28vh,220px)] space-y-1.5 overflow-y-auto text-xs">
          {issueItems.length === 0 ? (
            <li className="rounded-md border border-emerald-200 bg-emerald-50/60 px-2 py-1.5 text-emerald-800">
              Sem warnings/erros neste lote.
            </li>
          ) : (
            issueItems.map((item) => (
              <li
                key={`issue-${item.index}`}
                className={cn(
                  "rounded-md border px-2 py-1.5",
                  item.status === "failed" && "border-red-200 bg-red-50/50",
                  item.status !== "failed" && "border-amber-200 bg-amber-50/50",
                )}
              >
                <span className="font-mono text-zinc-500">[{item.index}]</span>{" "}
                {INGESTION_TYPE_LABELS_UI[item.type as keyof typeof INGESTION_TYPE_LABELS_UI] ??
                  item.type}{" "}
                {item.clientRef ? (
                  <span className="font-mono text-[10px] text-zinc-500"> ref:{item.clientRef}</span>
                ) : null}
                {item.status === "failed" && (
                  <span className="block text-red-800">{item.error}</span>
                )}
                {item.warnings?.map((w, j) => (
                  <div key={j} className="text-amber-800">
                    {w}
                  </div>
                ))}
              </li>
            ))
          )}
        </ul>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50/40 px-2 py-1.5">
          <p className="text-xs font-semibold text-emerald-900">Sucessos ({successItems.length})</p>
          <button
            type="button"
            onClick={() => setShowSuccessItems((v) => !v)}
            className="text-[11px] font-medium text-emerald-800 hover:underline"
          >
            {showSuccessItems ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {showSuccessItems ? (
          <ul className="max-h-[min(24vh,180px)] space-y-1.5 overflow-y-auto text-xs">
            {successItems.map((item) => (
              <li
                key={`ok-${item.index}`}
                className={cn(
                  "rounded-md border px-2 py-1.5",
                  item.status === "created" && "border-emerald-200 bg-emerald-50/50",
                  item.status === "updated" && "border-blue-200 bg-blue-50/50",
                  item.status === "skipped" && "border-zinc-200 bg-zinc-50/50",
                )}
              >
                <span className="font-mono text-zinc-500">[{item.index}]</span>{" "}
                {INGESTION_TYPE_LABELS_UI[item.type as keyof typeof INGESTION_TYPE_LABELS_UI] ??
                  item.type}{" "}
                {item.clientRef ? (
                  <span className="font-mono text-[10px] text-zinc-500"> ref:{item.clientRef}</span>
                ) : null}
                {item.status === "created" && (
                  <span className="block font-mono text-emerald-800">ID: {item.id}</span>
                )}
                {item.status === "updated" && (
                  <span className="block font-mono text-blue-800">Atualizado ID: {item.id}</span>
                )}
                {item.status === "skipped" && (
                  <span className="block text-zinc-500">Já existe (ID: {item.id})</span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {Object.keys(result.refMap).length > 0 && (
        <pre className="max-h-32 overflow-auto rounded bg-zinc-900 p-2 font-mono text-[10px] text-zinc-100">
          {JSON.stringify(result.refMap, null, 2)}
        </pre>
      )}
    </div>
  );
}

interface IngestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IngestionModal({ open, onOpenChange }: IngestionModalProps) {
  const [jsonText, setJsonText] = useState(INGESTION_DEFAULT_JSON);
  const [parseError, setParseError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("edit");
  const [validation, setValidation] = useState<IngestionValidationResponse["data"] | null>(null);
  const [executeResult, setExecuteResult] = useState<IngestionExecuteResponse["data"] | null>(null);
  const [dryRunResult, setDryRunResult] = useState<IngestionDryRunResponse["data"] | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [validatePending, setValidatePending] = useState(false);
  const [executePending, setExecutePending] = useState(false);
  const [dryRunPending, setDryRunPending] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [asyncJobSnapshot, setAsyncJobSnapshot] = useState<IngestionJobStatusPayload | null>(null);
  const [jobManualPending, setJobManualPending] = useState(false);

  const resetState = useCallback(() => {
    setJsonText(INGESTION_DEFAULT_JSON);
    setParseError(null);
    setStep("edit");
    setValidation(null);
    setExecuteResult(null);
    setDryRunResult(null);
    setActiveJobId(null);
    setAsyncJobSnapshot(null);
    setJobManualPending(false);
    setTemplateOpen(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
      if (!next) {
        setTimeout(() => resetState(), 200);
      }
    },
    [onOpenChange, resetState],
  );

  const handleJsonChange = useCallback(
    (text: string) => {
      setJsonText(text);
      if (text.trim()) {
        const { error } = parseJsonSafe(text);
        setParseError(error);
      } else {
        setParseError(null);
      }
      if (step !== "edit") setStep("edit");
    },
    [step],
  );

  const runValidate = async () => {
    setParseError(null);
    const { ok, error } = parseJsonSafe(jsonText);
    if (!ok) {
      setParseError(error ?? "JSON inválido");
      return;
    }
    setValidatePending(true);
    try {
      const payload = JSON.parse(jsonText) as unknown;
      const res = await validateIngestionAction(payload);
      setValidation(res.data);
      setDryRunResult(null);
      setStep("validated");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Erro ao validar");
    } finally {
      setValidatePending(false);
    }
  };

  const runExecute = async () => {
    setParseError(null);
    setExecutePending(true);
    try {
      const payload = JSON.parse(jsonText) as unknown;
      const out = await postAdminIngestionExecute(payload);
      if (out.mode === "async") {
        setActiveJobId(out.jobId);
        setAsyncJobSnapshot(null);
        return;
      }
      setExecuteResult(out.result);
      setStep("result");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Erro ao executar");
    } finally {
      setExecutePending(false);
    }
  };

  const refreshJobSnapshot = useCallback(async () => {
    if (!activeJobId) return;
    setJobManualPending(true);
    try {
      const snap = await fetchAdminIngestionJob(activeJobId);
      setAsyncJobSnapshot(snap);
      if (snap.status === "completed" && snap.result) {
        setExecuteResult(snap.result);
        setStep("result");
        setActiveJobId(null);
        await revalidateAfterIngestionAction();
      } else if (snap.status === "failed") {
        setParseError(snap.error ?? "A ingestão falhou no servidor.");
        setActiveJobId(null);
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Erro ao consultar o job");
    } finally {
      setJobManualPending(false);
    }
  }, [activeJobId]);

  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const snap = await fetchAdminIngestionJob(activeJobId);
        if (cancelled) return;
        setAsyncJobSnapshot(snap);
        if (snap.status === "completed" && snap.result) {
          setExecuteResult(snap.result);
          setStep("result");
          setActiveJobId(null);
          await revalidateAfterIngestionAction();
        } else if (snap.status === "failed") {
          setParseError(snap.error ?? "A ingestão falhou no servidor.");
          setActiveJobId(null);
        }
      } catch (e) {
        if (!cancelled) {
          setParseError(e instanceof Error ? e.message : "Erro ao consultar o job");
        }
      }
    };

    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeJobId]);

  const runDryRun = async () => {
    setParseError(null);
    setDryRunPending(true);
    try {
      const payload = JSON.parse(jsonText) as Record<string, unknown>;
      const res = await postAdminIngestionJson<IngestionDryRunResponse>(
        "/api/admin/ingestion/dry-run",
        { dryRun: true as const, payload },
      );
      setDryRunResult(res.data);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Erro na simulação");
    } finally {
      setDryRunPending(false);
    }
  };

  const jsonOk = !!jsonText.trim() && !parseError;
  const canValidate = jsonOk && step !== "result";
  const canExecute = step === "validated" && validation?.valid && !executePending && !activeJobId;
  const canDryRun = step === "validated" && validation?.valid && !dryRunPending;

  const rightTitle =
    step === "result" ? "Resultado" : step === "validated" ? "Validação" : "Referência";

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/35 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex h-[min(90vh,720px)] w-[min(92vw,1080px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl",
          )}
        >
          <Dialog.Title className="sr-only">Ingestão estruturada</Dialog.Title>
          <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 px-4 py-3 sm:px-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100">
              <Package className="h-4 w-4 text-violet-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900">Nova ingestão</p>
              <p className="truncate text-xs text-zinc-500">
                Arquivos pequenos terminam na hora nesta tela. Arquivos grandes (202) continuam em
                segundo plano e mostramos o progresso até concluir.
              </p>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setTemplateOpen((x) => !x)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <WandSparkles className="h-3.5 w-3.5" />
                Templates
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {templateOpen && (
                <div className="absolute top-full right-0 z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
                  {INGESTION_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setJsonText(JSON.stringify(tpl.payload, null, 2));
                        setParseError(null);
                        setStep("edit");
                        setValidation(null);
                        setDryRunResult(null);
                        setActiveJobId(null);
                        setAsyncJobSnapshot(null);
                        setTemplateOpen(false);
                      }}
                      className="flex w-full flex-col gap-0.5 border-b border-zinc-100 px-3 py-2.5 text-left last:border-0 hover:bg-zinc-50"
                    >
                      <span className="text-xs font-medium text-zinc-900">{tpl.label}</span>
                      <span className="text-[11px] text-zinc-500">{tpl.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Dialog.Close
              className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col border-r border-zinc-200">
              <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-3 py-2 sm:px-4">
                <div className="flex items-center gap-2">
                  <FileJson2 className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-xs font-medium text-zinc-500">Payload</span>
                  {parseError && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">
                      JSON inválido
                    </span>
                  )}
                  {!parseError && jsonText.trim() && (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      JSON ok
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!jsonText.trim()}
                  onClick={() => {
                    setJsonText(formatJson(jsonText));
                    setParseError(null);
                  }}
                  className="text-xs font-medium text-violet-700 hover:underline disabled:opacity-40"
                >
                  Formatar
                </button>
              </div>
              <textarea
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                spellCheck={false}
                placeholder={`{\n  "version": "1.0",\n  "mode": "create",\n  "objects": []\n}`}
                className="min-h-0 flex-1 resize-none bg-zinc-50/50 p-3 font-mono text-[13px] leading-relaxed text-zinc-900 focus:outline-none sm:p-4"
              />
              {parseError && (
                <div className="shrink-0 border-t border-red-100 bg-red-50/80 px-3 py-2 sm:px-4">
                  <p className="font-mono text-[11px] text-red-800">{parseError}</p>
                </div>
              )}
            </div>

            <div className="flex w-[min(380px,40vw)] shrink-0 flex-col border-l border-zinc-200 bg-zinc-50/30">
              <div className="shrink-0 border-b border-zinc-100 px-3 py-2">
                <span className="text-xs font-medium text-zinc-500">{rightTitle}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {step === "edit" && !validation && (
                  <div className="flex min-h-[260px] flex-col gap-2">
                    <p className="text-[11px] leading-snug text-zinc-600">
                      Referência de campos <strong className="text-zinc-900">obrigatórios</strong>,{" "}
                      <strong className="text-zinc-900">opcionais</strong> e{" "}
                      <strong className="text-zinc-900">condicionais</strong>. Use um template para
                      começar.
                    </p>
                    <IngestionFieldReferencePanel />
                  </div>
                )}
                {step === "validated" && validation && (
                  <div className="flex min-h-0 flex-col gap-0">
                    <ValidationPanel result={validation} />
                    {dryRunResult && <DryRunPanel result={dryRunResult} />}
                    {activeJobId ? (
                      <AsyncIngestionJobPanel
                        jobId={activeJobId}
                        snapshot={asyncJobSnapshot}
                        manualPending={jobManualPending}
                        onRefresh={() => void refreshJobSnapshot()}
                      />
                    ) : null}
                  </div>
                )}
                {step === "result" && executeResult && <ResultPanel result={executeResult} />}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3 sm:px-5">
            <p className="max-w-[min(100%,520px)] text-[11px] leading-snug text-zinc-500">
              {step === "edit" && <>v1.0 · {ingestionSupportedTypesFooter()}</>}
              {step === "validated" && validation && (
                <>
                  {validation.summary.total} objeto(s) ·{" "}
                  {validation.errors.length === 0
                    ? "sem erros"
                    : `${validation.errors.length} erro(s)`}
                  {dryRunResult?.valid === true && dryRunResult.planned.failed === 0 && (
                    <span className="text-sky-700"> · simulação OK</span>
                  )}
                  {activeJobId ? (
                    <span className="text-violet-700"> · ingestão em segundo plano</span>
                  ) : null}
                </>
              )}
              {step === "result" && executeResult && (
                <>
                  {executeResult.created} criado(s)
                  {(executeResult.updated ?? 0) > 0 && ` · ${executeResult.updated} atualizado(s)`}
                  {(executeResult.skipped ?? 0) > 0 && ` · ${executeResult.skipped} ignorado(s)`}
                  {executeResult.failed > 0 && ` · ${executeResult.failed} falha(s)`}
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {step === "result" ? "Fechar" : "Cancelar"}
              </button>
              {step !== "result" && (
                <button
                  type="button"
                  disabled={!canValidate || validatePending}
                  onClick={() => void runValidate()}
                  className="inline-flex min-w-[88px] items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {validatePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Validar
                </button>
              )}
              {step === "validated" && (
                <>
                  <button
                    type="button"
                    disabled={!canDryRun}
                    onClick={() => void runDryRun()}
                    className="inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50"
                  >
                    {dryRunPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Simular
                  </button>
                  <button
                    type="button"
                    disabled={!canExecute || executePending}
                    onClick={() => void runExecute()}
                    className="inline-flex min-w-[100px] items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {executePending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Package className="h-3.5 w-3.5" />
                    )}
                    Importar dados
                  </button>
                </>
              )}
              {step === "result" && (
                <button
                  type="button"
                  onClick={() => {
                    setStep("edit");
                    setExecuteResult(null);
                    setValidation(null);
                    setDryRunResult(null);
                    setActiveJobId(null);
                    setAsyncJobSnapshot(null);
                  }}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Novo payload
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
