import { getFunctions, httpsCallable } from "firebase/functions";
import { auth } from "../lib/firebase";
import firebaseApp from "../lib/firebase";

export type MediaResourceType = "image" | "video";

export interface UploadedMedia {
  url: string;
  publicId: string;
  resourceType: MediaResourceType;
  format: string;
  bytes: number;
}

interface SignatureRequest {
  resourceType: MediaResourceType;
  mimeType: string;
  fileSize: number;
}

interface SignatureResponse {
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
  resourceType: MediaResourceType;
  timestamp: number;
  folder: string;
  publicId: string;
  signature: string;
}

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  resource_type: string;
  format: string;
  bytes: number;
}

const functions = getFunctions(firebaseApp, "asia-south1");

const requestUploadSignature = httpsCallable<
  SignatureRequest,
  SignatureResponse
>(functions, "createCloudinaryUploadSignature");

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

function validateFile(file: File): MediaResourceType {
  if (!file || file.size <= 0) {
    throw new Error("Please select a valid file.");
  }

  if (IMAGE_TYPES.includes(file.type)) {
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error("Images cannot exceed 10 MB.");
    }

    return "image";
  }

  if (VIDEO_TYPES.includes(file.type)) {
    if (file.size > MAX_VIDEO_SIZE) {
      throw new Error("Videos cannot exceed 100 MB.");
    }

    return "video";
  }

  throw new Error(
    "Supported formats: JPEG, PNG, WebP, MP4 and WebM."
  );
}

function validateSignature(
  data: SignatureResponse,
  expectedType: MediaResourceType
): void {
  if (
    !data ||
    data.cloudName !== "erfojaws" ||
    data.resourceType !== expectedType ||
    !data.apiKey ||
    !data.signature ||
    !data.publicId ||
    !data.folder ||
    !Number.isSafeInteger(data.timestamp)
  ) {
    throw new Error("Invalid upload authorization response.");
  }
}

export async function uploadCOLMedia(
  file: File,
  onProgress?: (percentage: number) => void
): Promise<UploadedMedia> {
  if (!auth.currentUser) {
    throw new Error("Please sign in before uploading media.");
  }

  const resourceType = validateFile(file);

  try {
    const signatureResult = await requestUploadSignature({
      resourceType,
      mimeType: file.type,
      fileSize: file.size,
    });

    const signature = signatureResult.data;

    validateSignature(signature, resourceType);

    const formData = new FormData();

    formData.append("file", file);
    formData.append("api_key", signature.apiKey);
    formData.append("timestamp", String(signature.timestamp));
    formData.append("signature", signature.signature);
    formData.append("upload_preset", signature.uploadPreset);
    formData.append("folder", signature.folder);
    formData.append("public_id", signature.publicId);
    formData.append("overwrite", "false");

    const uploadUrl =
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/` +
      `${resourceType}/upload`;

    onProgress?.(5);

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });

    const result = await response.json() as
      | CloudinaryUploadResponse
      | { error?: { message?: string } };

    if (!response.ok) {
      const message =
        "error" in result
          ? result.error?.message
          : undefined;

      throw new Error(message || "Cloudinary upload failed.");
    }

    if (
      !("secure_url" in result) ||
      !result.secure_url.startsWith("https://") ||
      result.public_id !== signature.publicId ||
      result.resource_type !== resourceType ||
      !Number.isSafeInteger(result.bytes) ||
      result.bytes !== file.size
    ) {
      throw new Error("Cloudinary returned an invalid upload result.");
    }

    onProgress?.(100);

    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Media upload failed. Please try again.");
  }
}
