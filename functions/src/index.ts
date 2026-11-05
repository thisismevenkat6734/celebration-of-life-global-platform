
import { randomUUID } from "node:crypto";

import { v2 as cloudinary } from "cloudinary";

import { defineSecret } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const CLOUDINARY_API_SECRET = defineSecret(
  "CLOUDINARY_API_SECRET"
);

const CLOUDINARY_CLOUD_NAME = "erfojaws";
const CLOUDINARY_API_KEY = "212731271261822";
const CLOUDINARY_UPLOAD_PRESET = "col_user_media";

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

const ALLOWED_IMAGES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const ALLOWED_VIDEOS = [
  "video/mp4",
  "video/webm",
];

type ResourceType = "image" | "video";

interface UploadSignatureRequest {
  resourceType: ResourceType;
  mimeType: string;
  fileSize: number;
}

function validateUploadRequest(
  data: UploadSignatureRequest
): ResourceType {
  if (!data || typeof data !== "object") {
    throw new HttpsError(
      "invalid-argument",
      "Invalid upload request."
    );
  }

  if (
    data.resourceType !== "image" &&
    data.resourceType !== "video"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Unsupported media type."
    );
  }

  if (
    typeof data.mimeType !== "string" ||
    typeof data.fileSize !== "number" ||
    !Number.isSafeInteger(data.fileSize) ||
    data.fileSize <= 0
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid file information."
    );
  }

  if (data.resourceType === "image") {
    if (!ALLOWED_IMAGES.includes(data.mimeType)) {
      throw new HttpsError(
        "invalid-argument",
        "Only JPEG, PNG and WebP images are supported."
      );
    }

    if (data.fileSize > IMAGE_MAX_BYTES) {
      throw new HttpsError(
        "invalid-argument",
        "Image size cannot exceed 10 MB."
      );
    }
  }

  if (data.resourceType === "video") {
    if (!ALLOWED_VIDEOS.includes(data.mimeType)) {
      throw new HttpsError(
        "invalid-argument",
        "Only MP4 and WebM videos are supported."
      );
    }

    if (data.fileSize > VIDEO_MAX_BYTES) {
      throw new HttpsError(
        "invalid-argument",
        "Video size cannot exceed 100 MB."
      );
    }
  }

  return data.resourceType;
}

export const createCloudinaryUploadSignature = onCall(
  {
    region: "asia-south1",
    enforceAppCheck: true,
    secrets: [CLOUDINARY_API_SECRET],
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Please sign in before uploading media."
      );
    }

    const uid = request.auth.uid;

    const resourceType = validateUploadRequest(
      request.data as UploadSignatureRequest
    );

    const timestamp = Math.floor(Date.now() / 1000);

    const folder = `col/user-media/${uid}`;

    const publicId = randomUUID();

    const uploadParameters = {
      timestamp,
      folder,
      public_id: publicId,
      upload_preset: CLOUDINARY_UPLOAD_PRESET,
      overwrite: false,
    };

    try {
      const signature = cloudinary.utils.api_sign_request(
        uploadParameters,
        CLOUDINARY_API_SECRET.value()
      );

      return {
        cloudName: CLOUDINARY_CLOUD_NAME,
        apiKey: CLOUDINARY_API_KEY,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        resourceType,
        timestamp,
        folder,
        publicId,
        signature,
      };
    } catch {
      throw new HttpsError(
        "internal",
        "Unable to generate a secure upload signature."
      );
    }
  }
);
