import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/** Estilo padrão de `<select>`. Seta e padding à direita vêm de `globals.css`. */
export const formSelectClassName =
  "block w-full min-w-0 rounded-md border border-zinc-300 bg-white py-2.5 pl-3 text-sm text-zinc-900 shadow-sm transition-[border-color,box-shadow] hover:border-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-500";

/** Variante compacta (filtros inline, destino, etc.). */
export const formSelectCompactClassName =
  "block w-auto min-w-[8rem] rounded-md border border-zinc-300 bg-white py-1.5 pl-2.5 text-sm text-zinc-900 shadow-sm transition-[border-color,box-shadow] hover:border-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200/80 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-500";

export type SelectProps = ComponentPropsWithoutRef<"select"> & {
  compact?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, compact, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(compact ? formSelectCompactClassName : formSelectClassName, className)}
      {...props}
    />
  );
});
