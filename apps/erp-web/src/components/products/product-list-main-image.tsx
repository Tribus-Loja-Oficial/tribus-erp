"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { isPreviewableProductFileId, productFilePreviewSrc } from "@/lib/product-file-preview";

const PREVIEW_CLASS = "h-14 w-14";

function EmptyImagePlaceholder({ title }: { title: string }) {
  return (
    <div
      className={cn(
        PREVIEW_CLASS,
        "flex shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-zinc-400",
      )}
      title={title}
    >
      <ImageIcon className="h-5 w-5" aria-hidden />
      <span className="sr-only">{title}</span>
    </div>
  );
}

export function ProductListMainImage({
  mainImageFileId,
  name,
}: {
  mainImageFileId?: string | null;
  name: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!isPreviewableProductFileId(mainImageFileId)) {
    return <EmptyImagePlaceholder title="Sem imagem principal" />;
  }

  if (failed) {
    return <EmptyImagePlaceholder title="Não foi possível carregar a imagem" />;
  }

  const src = productFilePreviewSrc(mainImageFileId!);

  return (
    <div
      className={cn(
        PREVIEW_CLASS,
        "relative shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100",
      )}
      title={`Imagem principal: ${name}`}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-zinc-100 to-zinc-200 transition-opacity duration-300",
          loaded ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        aria-hidden
      >
        <div className="absolute inset-0 animate-pulse bg-zinc-200/80" />
      </div>
      <img
        key={src}
        src={src}
        alt=""
        width={56}
        height={56}
        className={cn(
          PREVIEW_CLASS,
          "relative object-cover transition-opacity duration-300 ease-out",
          loaded ? "opacity-100" : "opacity-0",
        )}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
