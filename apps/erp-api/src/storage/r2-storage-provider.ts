import type {
  StorageProvider,
  PutObjectInput,
  StoredObject,
  GetSignedUrlInput,
  DeleteObjectInput,
  GetObjectOutput,
} from "./storage-provider.js";

export class R2StorageProvider implements StorageProvider {
  constructor(private readonly bucket: R2Bucket) {}

  async getObject(key: string): Promise<GetObjectOutput | null> {
    const object = await this.bucket.get(key);
    if (!object?.body) return null;
    const contentType = object.httpMetadata?.contentType ?? "application/octet-stream";
    return { body: object.body, contentType };
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const object = await this.bucket.put(input.key, input.body, {
      httpMetadata: { contentType: input.contentType },
      customMetadata: input.metadata,
    });
    if (!object) throw new Error(`Failed to upload object: ${input.key}`);
    return {
      key: input.key,
      size: object.size,
      etag: object.etag,
    };
  }

  async getSignedUrl(input: GetSignedUrlInput): Promise<string> {
    const expiresIn = input.expiresInSeconds ?? 3600;
    const object = await this.bucket.createMultipartUpload(input.key);
    void object;
    // R2 doesn't support presigned URLs natively in Workers — return a direct URL pattern.
    // In production, use a signed URL service or expose via a dedicated route.
    return `/documents/${input.key}?expires=${Date.now() + expiresIn * 1000}`;
  }

  async deleteObject(input: DeleteObjectInput): Promise<void> {
    await this.bucket.delete(input.key);
  }
}
