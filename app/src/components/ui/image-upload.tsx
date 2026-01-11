"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2, Upload, X, AlertCircle } from "lucide-react";

export interface ImageUploadProps {
    /** Current image URL */
    value?: string;
    /** Callback when image URL changes */
    onChange: (url: string | undefined) => void;
    /** Callback when upload state changes (true = uploading, false = idle) */
    onUploadingChange?: (isUploading: boolean) => void;
    /** Folder path in S3 (e.g., "trucks", "employees") */
    folder?: string;
    /** Placeholder text when no image */
    placeholder?: string;
    /** Whether the input is disabled */
    disabled?: boolean;
    /** CSS class for the container */
    className?: string;
    /** Aspect ratio (e.g., "square", "video", "auto") */
    aspect?: "square" | "video" | "auto";
}

type UploadState = "idle" | "loading" | "uploading" | "success" | "error";

export function ImageUpload({
    value,
    onChange,
    onUploadingChange,
    folder = "uploads",
    placeholder = "Upload an image",
    disabled = false,
    className,
    aspect = "auto",
}: ImageUploadProps) {
    const [state, setState] = useState<UploadState>("idle");
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const aspectClasses = {
        square: "aspect-square",
        video: "aspect-video",
        auto: "min-h-40",
    };

    const uploadFile = useCallback(async (file: File) => {
        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            setError("Invalid file type. Allowed: JPEG, PNG, GIF, WebP");
            setState("error");
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            setError("File too large. Maximum size is 5MB");
            setState("error");
            return;
        }

        // Create local preview
        const localPreview = URL.createObjectURL(file);
        setPreviewUrl(localPreview);
        setState("uploading");
        onUploadingChange?.(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folder", folder);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Upload failed");
            }

            onChange(result.url);
            setState("success");
            onUploadingChange?.(false);
            setPreviewUrl(null);

            // Revoke local preview URL
            URL.revokeObjectURL(localPreview);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
            setState("error");
            onUploadingChange?.(false);
            setPreviewUrl(null);
            URL.revokeObjectURL(localPreview);
        }
    }, [folder, onChange, onUploadingChange]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadFile(file);
        }
        // Reset input value so the same file can be selected again
        e.target.value = "";
    }, [uploadFile]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);

        if (disabled) return;

        const file = e.dataTransfer.files?.[0];
        if (file) {
            uploadFile(file);
        }
    }, [disabled, uploadFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!disabled) {
            setDragOver(true);
        }
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
    }, []);

    const handleRemove = useCallback(() => {
        onChange(undefined);
        setState("idle");
        setError(null);
        setPreviewUrl(null);
    }, [onChange]);

    const handleClick = useCallback(() => {
        if (!disabled && state !== "uploading") {
            inputRef.current?.click();
        }
    }, [disabled, state]);

    const displayUrl = previewUrl || value;
    const hasImage = !!displayUrl;
    const isUploading = state === "uploading";
    const hasError = state === "error";

    return (
        <div className={cn("relative", className)}>
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileSelect}
                disabled={disabled || isUploading}
                className="hidden"
            />

            <div
                onClick={handleClick}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                    "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors overflow-hidden",
                    aspectClasses[aspect],
                    dragOver && "border-primary bg-primary/5",
                    hasError && "border-destructive bg-destructive/5",
                    !hasImage && !dragOver && !hasError && "border-muted-foreground/25 hover:border-muted-foreground/50",
                    hasImage && "border-transparent",
                    disabled && "opacity-50 cursor-not-allowed",
                    !disabled && !isUploading && "cursor-pointer"
                )}
            >
                {hasImage ? (
                    <>
                        <Image
                            src={displayUrl}
                            alt="Uploaded image"
                            fill
                            className={cn(
                                "object-cover",
                                isUploading && "opacity-50"
                            )}
                        />
                        {isUploading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="text-sm font-medium">Uploading...</span>
                                </div>
                            </div>
                        )}
                        {!isUploading && !disabled && (
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 h-8 w-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemove();
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 p-6 text-center">
                        {hasError ? (
                            <>
                                <AlertCircle className="h-10 w-10 text-destructive" />
                                <span className="text-sm text-destructive">{error}</span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setState("idle");
                                        setError(null);
                                    }}
                                >
                                    Try again
                                </Button>
                            </>
                        ) : isUploading ? (
                            <>
                                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Uploading...</span>
                            </>
                        ) : (
                            <>
                                {dragOver ? (
                                    <Upload className="h-10 w-10 text-primary" />
                                ) : (
                                    <ImageIcon className="h-10 w-10 text-muted-foreground" />
                                )}
                                <span className="text-sm text-muted-foreground">
                                    {dragOver ? "Drop to upload" : placeholder}
                                </span>
                                <span className="text-xs text-muted-foreground/70">
                                    JPEG, PNG, GIF, WebP up to 5MB
                                </span>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
