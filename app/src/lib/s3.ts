"use server";

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// S3 client singleton
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
    if (!s3Client) {
        const region = process.env.AWS_REGION;
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!region || !accessKeyId || !secretAccessKey) {
            throw new Error("Missing AWS S3 configuration. Please set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY environment variables.");
        }

        s3Client = new S3Client({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }
    return s3Client;
}

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "";
const CDN_URL = process.env.AWS_CLOUDFRONT_URL || `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;

export interface UploadResult {
    success: boolean;
    url?: string;
    key?: string;
    error?: string;
}

/**
 * Upload a file to S3
 * @param file - The file buffer to upload
 * @param filename - Original filename (used to determine content type)
 * @param folder - Optional folder path in S3 (e.g., "trucks", "employees")
 */
export async function uploadToS3(
    file: Buffer,
    filename: string,
    folder: string = "uploads"
): Promise<UploadResult> {
    try {
        const client = getS3Client();
        
        // Generate unique filename
        const extension = filename.split(".").pop()?.toLowerCase() || "jpg";
        const key = `${folder}/${uuidv4()}.${extension}`;

        // Determine content type
        const contentTypeMap: Record<string, string> = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            svg: "image/svg+xml",
        };
        const contentType = contentTypeMap[extension] || "application/octet-stream";

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: file,
            ContentType: contentType,
        });

        await client.send(command);

        const url = `${CDN_URL}/${key}`;

        return {
            success: true,
            url,
            key,
        };
    } catch (error) {
        console.error("S3 upload error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to upload file",
        };
    }
}

/**
 * Delete a file from S3
 * @param key - The S3 key of the file to delete
 */
export async function deleteFromS3(key: string): Promise<{ success: boolean; error?: string }> {
    try {
        const client = getS3Client();

        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        await client.send(command);

        return { success: true };
    } catch (error) {
        console.error("S3 delete error:", error);
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
        const client = getS3Client();
        
        const extension = filename.split(".").pop()?.toLowerCase() || "jpg";
        const key = `${folder}/${uuidv4()}.${extension}`;

        const contentTypeMap: Record<string, string> = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            svg: "image/svg+xml",
        };
        const contentType = contentTypeMap[extension] || "application/octet-stream";

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(client, command, { expiresIn });
        const publicUrl = `${CDN_URL}/${key}`;

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
 * Extract S3 key from a full URL
 */
export function getKeyFromUrl(url: string): string | null {
    try {
        const urlObj = new URL(url);
        // Remove leading slash
        return urlObj.pathname.substring(1);
    } catch {
        return null;
    }
}
