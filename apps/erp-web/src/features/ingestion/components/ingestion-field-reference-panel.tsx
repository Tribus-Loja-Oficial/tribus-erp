"use client";

import { BookOpen, FileJson } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INGESTION_ENVELOPE_META,
  INGESTION_TYPE_REFERENCES,
  INGESTION_TYPE_LABELS_UI,
  type FieldRequirement,
} from "@/features/ingestion/lib/ingestion-field-reference";

function ReqBadge({ requirement }: { requirement: FieldRequirement }) {
  const label =
    requirement === "required" ? "Obrig." : requirement === "conditional" ? "Cond." : "Opc.";
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase",
        requirement === "required" && "bg-violet-100 text-violet-800",
        requirement === "optional" && "bg-zinc-100 text-zinc-600",
        requirement === "conditional" && "bg-amber-100 text-amber-900",
      )}
    >
      {label}
    </span>
  );
}

export function IngestionFieldReferencePanel() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2.5">
        <p className="text-[11px] leading-snug text-zinc-600">
          <strong className="text-zinc-900">Envelope</strong>:{" "}
          <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-[10px]">version</code>{" "}
          <ReqBadge requirement="required" /> <code className="text-[10px]">1.0</code>,{" "}
          <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-[10px]">mode</code>{" "}
          <ReqBadge requirement="required" /> <code className="text-[10px]">create</code>,{" "}
          <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-[10px]">objects</code>{" "}
          <ReqBadge requirement="required" /> {INGESTION_ENVELOPE_META.objects.hint}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href="/ingestion-payload.schema.json"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <FileJson className="h-3 w-3" />
            JSON Schema
          </a>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
            <BookOpen className="h-3 w-3" />
            <code className="rounded bg-zinc-100 px-1">
              docs/reference/ingestion-ai-master-template.md
            </code>
          </span>
        </div>
      </div>

      <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
        Campos por tipo (em <code className="text-[10px]">data</code>)
      </p>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {INGESTION_TYPE_REFERENCES.map((spec) => (
          <details
            key={spec.type}
            className="group rounded-lg border border-zinc-200/90 bg-white open:bg-zinc-50/50"
          >
            <summary className="cursor-pointer list-none px-2.5 py-2 text-xs font-medium text-zinc-900 marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                <span>{INGESTION_TYPE_LABELS_UI[spec.type]}</span>
                <span className="font-mono text-[10px] font-normal text-zinc-500">{spec.type}</span>
              </span>
            </summary>
            <div className="border-t border-zinc-100 px-2.5 pt-1 pb-2.5">
              <p className="mb-2 text-[10px] text-zinc-600">{spec.summary}</p>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="pr-1 pb-1 font-medium">Campo</th>
                    <th className="pr-1 pb-1 font-medium">Req.</th>
                    <th className="pb-1 font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {spec.dataFields.map((row) => (
                    <tr key={row.key} className="border-t border-zinc-100 align-top">
                      <td className="py-1 pr-1 font-mono text-zinc-900">{row.key}</td>
                      <td className="py-1 pr-1">
                        <ReqBadge requirement={row.requirement} />
                      </td>
                      <td className="py-1 text-zinc-600">
                        <span>{row.valueType}</span>
                        {row.enumValues && (
                          <span className="mt-0.5 block font-mono text-[9px] leading-tight text-zinc-800">
                            [{row.enumValues.join(" | ")}]
                          </span>
                        )}
                        {row.default && (
                          <span className="mt-0.5 block text-[9px]">padrão: {row.default}</span>
                        )}
                        {row.maxLength && (
                          <span className="mt-0.5 block text-[9px]">máx. {row.maxLength}</span>
                        )}
                        {row.condition && (
                          <span className="mt-0.5 block text-[9px] text-amber-800">
                            {row.condition}
                          </span>
                        )}
                        {row.hint && (
                          <span className="mt-0.5 block text-[9px] text-zinc-500 italic">
                            {row.hint}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
