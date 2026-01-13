import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { uploadToS3 } from "@/lib/s3";

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed image types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(request: NextRequest) {
    try {
        // Verify user is authenticated
        await requireAuth();

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const folder = (formData.get("folder") as string) || "uploads";

        if (!file) {
            return NextResponse.json(
                { success: false, error: "No file provided" },
                { status: 400 }
            );
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { success: false, error: "Invalid file type. Allowed types: JPEG, PNG, GIF, WebP" },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { success: false, error: "File too large. Maximum size is 5MB" },
                { status: 400 }
            );
        }

        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Upload to S3
        const result = await uploadToS3(buffer, file.name, folder);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            url: result.url,
            key: result.key,
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { success: false, error: "Upload failed" },
            { status: 500 }
        );
    }
}
