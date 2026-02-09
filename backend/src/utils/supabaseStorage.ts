import { createClient, SupabaseClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "Supabase credentials not found. File storage features will not work."
  );
}

// Initialize Supabase client with service role key for admin operations
export const supabaseStorage: SupabaseClient | null = process.env
  .SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Storage bucket names
export const STORAGE_BUCKETS = {
  SUPPLIER_DOCUMENTS: "supplier-documents",
  MATERIAL_REQUEST_ATTACHMENTS: "material-request-attachments",
  MATERIAL_DOCUMENTS: "material-documents",
  GENERAL_DOCUMENTS: "general-documents",
} as const;

/**
 * Build a public URL for a stored object path (bucket must be public)
 */
export function getPublicUrl(bucket: string, filePath: string): string {
  if (!supabaseStorage) {
    throw new Error("Supabase Storage is not configured");
  }
  const { data } = supabaseStorage.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  bucket: string,
  filePath: string,
  fileBuffer: Buffer | Uint8Array | ArrayBuffer,
  contentType?: string
): Promise<{ path: string; url: string }> {
  if (!supabaseStorage) {
    throw new Error("Supabase Storage is not configured");
  }

  const toBlob = (data: Buffer | Uint8Array | ArrayBuffer, type?: string): Blob => {
    const mime = type || "application/octet-stream";
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
      return new Blob([data], { type: mime });
    }
    if (data instanceof Uint8Array) {
      return new Blob([data], { type: mime });
    }
    if (data instanceof ArrayBuffer) {
      return new Blob([data], { type: mime });
    }
    throw new Error("Unsupported file buffer type");
  };
  const blob = toBlob(fileBuffer, contentType);

  const { data, error } = await supabaseStorage.storage
    .from(bucket)
    .upload(filePath, blob, {
      contentType: contentType || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL (or signed URL if bucket is private)
  const { data: urlData } = supabaseStorage.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}

/**
 * Download a file from Supabase Storage
 */
export async function downloadFile(
  bucket: string,
  filePath: string
): Promise<Buffer> {
  if (!supabaseStorage) {
    throw new Error("Supabase Storage is not configured");
  }

  const { data, error } = await supabaseStorage.storage
    .from(bucket)
    .download(filePath);

  if (error) {
    throw new Error(`Failed to download file: ${error.message}`);
  }

  if (!data) {
    throw new Error("File not found");
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(
  bucket: string,
  filePath: string
): Promise<void> {
  if (!supabaseStorage) {
    throw new Error("Supabase Storage is not configured");
  }

  const { error } = await supabaseStorage.storage
    .from(bucket)
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Get a signed URL for private file access (valid for specified duration)
 */
export async function getSignedUrl(
  bucket: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!supabaseStorage) {
    throw new Error("Supabase Storage is not configured");
  }

  const { data, error } = await supabaseStorage.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * List files in a bucket folder
 */
export async function listFiles(
  bucket: string,
  folderPath?: string
): Promise<string[]> {
  if (!supabaseStorage) {
    throw new Error("Supabase Storage is not configured");
  }

  const { data, error } = await supabaseStorage.storage
    .from(bucket)
    .list(folderPath || "", {
      limit: 100,
      offset: 0,
    });

  if (error) {
    throw new Error(`Failed to list files: ${error.message}`);
  }

  return data.map((file) => file.name);
}

/**
 * Generate a unique file path
 */
export function generateFilePath(
  prefix: string,
  originalFileName: string,
  userId?: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalFileName.split(".").pop() || "";
  const sanitizedName = originalFileName
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .substring(0, 50);
  const userIdPart = userId ? `${userId}/` : "";
  return `${prefix}/${userIdPart}${timestamp}_${random}_${sanitizedName}`;
}
