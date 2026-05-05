"use client";

import { useState, useTransition } from "react";
import { resetAllDataAction } from "@/server/settings-actions";

const CONFIRM_TEXT = "LIMPAR TUDO";

export function DangerZone() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  function handleOpen() {
    setShowConfirm(true);
    setResult(null);
  }

  function handleCancel() {
    setShowConfirm(false);
    setConfirmInput("");
    setResult(null);
  }

  function handleReset() {
    startTransition(async () => {
      try {
        await resetAllDataAction();
        setResult({ ok: true });
        setShowConfirm(false);
        setConfirmInput("");
      } catch (err) {
        setResult({ ok: false, error: err instanceof Error ? err.message : "Erro desconhecido." });
      }
    });
  }

  return (
    <div className="max-w-xl rounded-xl border border-red-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-red-700">Zona de perigo</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Apaga permanentemente todos os dados do ERP: produtos, variantes, categorias, coleções,
        locais de stock, movimentos, pedidos, ordens de compra, entidades, clientes, fornecedores,
        registos financeiros e fiscais.{" "}
        <strong className="text-red-600">Esta acção não pode ser revertida.</strong>
      </p>

      {result?.ok && (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Base de dados limpa com sucesso.
        </p>
      )}

      {result?.error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.error}
        </p>
      )}

      {!showConfirm ? (
        <button
          onClick={handleOpen}
          disabled={isPending}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Limpar todos os dados
        </button>
      ) : (
        <div className="space-y-3 rounded-md border border-red-200 bg-red-50/40 p-4">
          <p className="text-sm text-zinc-700">
            Escreva{" "}
            <code className="rounded bg-red-100 px-1 font-mono text-sm text-red-700">
              {CONFIRM_TEXT}
            </code>{" "}
            para confirmar:
          </p>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={CONFIRM_TEXT}
            disabled={isPending}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none disabled:opacity-50"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={confirmInput !== CONFIRM_TEXT || isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "A apagar…" : "Confirmar e apagar tudo"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
