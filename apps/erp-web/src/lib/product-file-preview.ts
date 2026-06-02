const PRODUCT_FILE_ID_RE = /^file_[a-f0-9]{32}$/i;

export function isPreviewableProductFileId(raw: string | null | undefined): boolean {
  const t = raw?.trim();
  return Boolean(t && PRODUCT_FILE_ID_RE.test(t));
}

export function productFilePreviewSrc(fileId: string): string {
  return `/api/product-files/${encodeURIComponent(fileId.trim())}`;
}
