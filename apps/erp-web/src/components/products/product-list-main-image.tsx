"use client";

import { ImageIcon, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { isPreviewableProductFileId, productFilePreviewSrc } from "@/lib/product-file-preview";

const THUMB_CLASS = "h-[70px] w-[70px]";
const HOVER_PREVIEW_DELAY_MS = 1000;
const HOVER_PREVIEW_HIDE_MS = 120;
const POPUP_SIZE_PX = 320;

function EmptyImagePlaceholder({ title }: { title: string }) {
  return (
    <div
      className={cn(
        THUMB_CLASS,
        "flex shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-zinc-400",
      )}
      title={title}
    >
      <ImageIcon className="h-5 w-5" aria-hidden />
      <span className="sr-only">{title}</span>
    </div>
  );
}

function clampPopupPosition(anchor: DOMRect): { top: number; left: number } {
  const gap = 12;
  const pad = 8;
  let left = anchor.right + gap;
  let top = anchor.top + anchor.height / 2 - POPUP_SIZE_PX / 2;

  if (left + POPUP_SIZE_PX > window.innerWidth - pad) {
    left = anchor.left - gap - POPUP_SIZE_PX;
  }
  if (left < pad) left = pad;

  top = Math.max(pad, Math.min(top, window.innerHeight - POPUP_SIZE_PX - pad - 36));
  return { top, left };
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
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const [popupLoaded, setPopupLoaded] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearShowTimer = () => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  };

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const updatePopupPosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    setPopupPos(clampPopupPosition(el.getBoundingClientRect()));
  }, []);

  const openPopup = useCallback(() => {
    updatePopupPosition();
    setPopupLoaded(false);
    setPopupOpen(true);
  }, [updatePopupPosition]);

  const schedulePopup = useCallback(() => {
    clearHideTimer();
    clearShowTimer();
    showTimerRef.current = setTimeout(openPopup, HOVER_PREVIEW_DELAY_MS);
  }, [openPopup]);

  const scheduleClose = useCallback(() => {
    clearShowTimer();
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setPopupOpen(false), HOVER_PREVIEW_HIDE_MS);
  }, []);

  const cancelClose = useCallback(() => {
    clearHideTimer();
  }, []);

  useEffect(
    () => () => {
      clearShowTimer();
      clearHideTimer();
    },
    [],
  );

  useEffect(() => {
    if (!popupOpen) return;
    updatePopupPosition();
    const onReposition = () => updatePopupPosition();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [popupOpen, updatePopupPosition]);

  if (!isPreviewableProductFileId(mainImageFileId)) {
    return <EmptyImagePlaceholder title="Sem imagem principal" />;
  }

  if (failed) {
    return <EmptyImagePlaceholder title="Não foi possível carregar a imagem" />;
  }

  const src = productFilePreviewSrc(mainImageFileId!);

  return (
    <>
      <div
        ref={anchorRef}
        className={cn(
          THUMB_CLASS,
          "relative shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100",
        )}
        title={`Imagem principal: ${name}`}
        onMouseEnter={schedulePopup}
        onMouseLeave={scheduleClose}
        onFocus={schedulePopup}
        onBlur={scheduleClose}
      >
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 transition-opacity duration-300",
            loaded ? "pointer-events-none opacity-0" : "opacity-100",
          )}
          role="status"
          aria-live="polite"
          aria-label="A carregar imagem"
        >
          <div className="absolute inset-0 animate-pulse bg-zinc-200/60" aria-hidden />
          <Loader2 className="relative h-6 w-6 animate-spin text-zinc-400" aria-hidden />
          <span className="sr-only">A carregar imagem</span>
        </div>
        <img
          key={src}
          src={src}
          alt=""
          width={70}
          height={70}
          className={cn(
            THUMB_CLASS,
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

      {popupOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-auto fixed z-[200] opacity-100 transition-opacity duration-200"
              style={{
                top: popupPos.top,
                left: popupPos.left,
                width: POPUP_SIZE_PX,
              }}
              role="tooltip"
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl ring-1 ring-black/5">
                <div
                  className="relative flex items-center justify-center bg-zinc-50"
                  style={{ height: POPUP_SIZE_PX }}
                >
                  {!popupLoaded ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-100">
                      <Loader2 className="h-8 w-8 animate-spin text-zinc-400" aria-hidden />
                    </div>
                  ) : null}
                  <img
                    src={src}
                    alt={name}
                    className={cn(
                      "max-h-full max-w-full object-contain p-2 transition-opacity duration-200",
                      popupLoaded ? "opacity-100" : "opacity-0",
                    )}
                    onLoad={() => setPopupLoaded(true)}
                  />
                </div>
                <p className="truncate border-t border-zinc-100 px-3 py-2 text-xs font-medium text-zinc-800">
                  {name}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
