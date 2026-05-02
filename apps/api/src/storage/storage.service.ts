import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = config.getOrThrow<string>("SUPABASE_URL");
    const key = config.getOrThrow<string>("SUPABASE_SERVICE_ROLE_KEY");
    this.client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this.logger.log("StorageService initialized");
  }

  async upload(opts: {
    bucket: string;
    path: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<void> {
    const { error } = await this.client.storage
      .from(opts.bucket)
      .upload(opts.path, opts.buffer, {
        contentType: opts.contentType,
        upsert: false,
      });
    if (error) {
      this.logger.error(
        `Upload failed: bucket=${opts.bucket} path=${opts.path}: ${error.message}`,
      );
      throw new ServiceUnavailableException({
        code: "STORAGE_UPLOAD_FAILED",
        message: `Could not store file: ${error.message}`,
      });
    }
  }

  async delete(opts: { bucket: string; path: string }): Promise<void> {
    const { error } = await this.client.storage.from(opts.bucket).remove([opts.path]);
    if (error) {
      this.logger.warn(`Delete failed: ${error.message}`);
      // Non-fatal
    }
  }

  async download(opts: { bucket: string; path: string }): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(opts.bucket).download(opts.path);
    if (error || !data) {
      this.logger.error(`Download failed: ${error?.message ?? "no data"}`);
      throw new ServiceUnavailableException({
        code: "STORAGE_DOWNLOAD_FAILED",
        message: `Could not retrieve file: ${error?.message ?? "no data"}`,
      });
    }
    const arrayBuf = await data.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async signedUrl(opts: {
    bucket: string;
    path: string;
    expiresIn: number;
  }): Promise<string> {
    const { data, error } = await this.client.storage
      .from(opts.bucket)
      .createSignedUrl(opts.path, opts.expiresIn);
    if (error || !data?.signedUrl) {
      throw new ServiceUnavailableException({
        code: "STORAGE_SIGNED_URL_FAILED",
        message: `Could not create signed URL: ${error?.message ?? "no url"}`,
      });
    }
    return data.signedUrl;
  }
}
