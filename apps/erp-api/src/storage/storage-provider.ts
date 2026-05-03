export interface PutObjectInput {
  key: string;
  body: ReadableStream | ArrayBuffer | Uint8Array | string;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface StoredObject {
  key: string;
  size: number;
  etag: string;
}

export interface GetSignedUrlInput {
  key: string;
  expiresInSeconds?: number;
}

export interface DeleteObjectInput {
  key: string;
}

export interface GetObjectOutput {
  body: ReadableStream;
  contentType: string;
}

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  getSignedUrl(input: GetSignedUrlInput): Promise<string>;
  deleteObject(input: DeleteObjectInput): Promise<void>;
  getObject(key: string): Promise<GetObjectOutput | null>;
}
