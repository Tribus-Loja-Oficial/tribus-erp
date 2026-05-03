export interface UploadedProductMediaRow {
  id: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  referenceType: string | null;
  referenceId: string | null;
}
