"use server";

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// Cloudflare R2 speaks the S3 API, so the AWS SDK works against it unmodified
// — only the endpoint/region/credentials differ from real AWS S3. This
// replaces the old S3-based src/lib/s3.ts.
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
    if (!r2Client) {
        const accountId = process.env.R2_ACCOUNT_ID;
        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

        if (!accountId || !accessKeyId || !secretAccessKey) {
            throw new Error("Missing Cloudflare R2 configuration. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.");
        }

        r2Client = new S3Client({
            region: "auto",
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }
    return r2Client;
}

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "";
// R2 has no CloudFront-style fallback domain like S3 does — a bucket isn't
// reachable over HTTP at all until you either enable its public r2.dev URL
// or map a custom domain to it in the Cloudflare dashboard, and put that
// here. Unlike the old s3.ts, there's no default to fall back to.
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

export interface UploadResult {
    success: boolean;
    url?: string;
    key?: string;
    error?: string;
}

const CONTENT_TYPE_MAP: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
};

/**
 * Upload a file to R2
 * @param file - The file buffer to upload
 * @param filename - Original filename (used to determine content type)
 * @param folder - Optional folder path in the bucket (e.g., "trucks", "employees")
 */
export async function uploadToR2(
    file: Buffer,
    filename: string,
    folder: string = "uploads"
): Promise<UploadResult> {
    try {
        const client = getR2Client();

        // Generate unique filename
        const extension = filename.split(".").pop()?.toLowerCase() || "jpg";
        const key = `${folder}/${uuidv4()}.${extension}`;
        const contentType = CONTENT_TYPE_MAP[extension] || "application/octet-stream";

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: file,
            ContentType: contentType,
        });

        await client.send(command);

        const url = `${PUBLIC_URL}/${key}`;

        return {
            success: true,
            url,
            key,
        };
    } catch (error) {
        console.error("R2 upload error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to upload file",
        };
    }
}

/**
 * Delete a file from R2
 * @param key - The R2 object key of the file to delete
 */
export async function deleteFromR2(key: string): Promise<{ success: boolean; error?: string }> {
    try {
        const client = getR2Client();

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        await client.send(command);

        return { success: true };
    } catch (error) {
        console.error("R2 delete error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete file",
        };
    }
}

/**
 * Generate a presigned URL for direct client-side upload
 * @param filename - Original filename
 * @param folder - Optional folder path
 * @param expiresIn - URL expiration time in seconds (default: 60)
 */
export async function getPresignedUploadUrl(
    filename: string,
    folder: string = "uploads",
    expiresIn: number = 60
): Promise<{ success: boolean; uploadUrl?: string; key?: string; publicUrl?: string; error?: string }> {
    try {
        const client = getR2Client();

        const extension = filename.split(".").pop()?.toLowerCase() || "jpg";
        const key = `${folder}/${uuidv4()}.${extension}`;
        const contentType = CONTENT_TYPE_MAP[extension] || "application/octet-stream";

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(client, command, { expiresIn });
        const publicUrl = `${PUBLIC_URL}/${key}`;

        return {
            success: true,
            uploadUrl,
            key,
            publicUrl,
        };
    } catch (error) {
        console.error("Presigned URL error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to generate upload URL",
        };
    }
}

/**
 * Extract the R2 object key from a full public URL
 */
export async function getKeyFromUrl(url: string): Promise<string | null> {
    try {
        const urlObj = new URL(url);
        // Remove leading slash
        return urlObj.pathname.substring(1);
    } catch {
        return null;
    }
}
