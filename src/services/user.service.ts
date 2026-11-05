import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";

import type { User } from "firebase/auth";
import { db } from "../lib/firebase";

export type ProfileVisibility = "public" | "private";

export interface COLUserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  bio: string;
  location: string | null;
  visibility: ProfileVisibility;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function profileReference(uid: string) {
  if (!uid || uid.trim().length === 0) {
    throw new Error("A valid user ID is required.");
  }

  return doc(db, "users", uid);
}

function validateDisplayName(name: string): string {
  const value = name.trim();

  if (value.length < 2 || value.length > 50) {
    throw new Error("Name must contain between 2 and 50 characters.");
  }

  return value;
}

function validateBio(bio: string): string {
  const value = bio.trim();

  if (value.length > 300) {
    throw new Error("Bio cannot exceed 300 characters.");
  }

  return value;
}

function toProfile(
  uid: string,
  data: DocumentData
): COLUserProfile {
  return {
    uid,
    displayName: String(data.displayName ?? ""),
    email: String(data.email ?? ""),
    photoURL:
      typeof data.photoURL === "string"
        ? data.photoURL
        : null,
    bio: String(data.bio ?? ""),
    location:
      typeof data.location === "string"
        ? data.location
        : null,
    visibility:
      data.visibility === "private"
        ? "private"
        : "public",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function createUserProfile(
  user: User
): Promise<COLUserProfile> {
  if (!user.uid || !user.email) {
    throw new Error("Authenticated user information is incomplete.");
  }

  const reference = profileReference(user.uid);

  try {
    const existing = await getDoc(reference);

    if (existing.exists()) {
      return toProfile(user.uid, existing.data());
    }

    const profile: Omit<
      COLUserProfile,
      "createdAt" | "updatedAt"
    > = {
      uid: user.uid,
      displayName: validateDisplayName(
        user.displayName || "COL Member"
      ),
      email: user.email,
      photoURL: user.photoURL,
      bio: "",
      location: null,
      visibility: "public",
    };

    await setDoc(reference, {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return profile;
  } catch {
    throw new Error(
      "Unable to create your profile. Please check your connection and account permissions."
    );
  }
}

export async function getUserProfile(
  uid: string
): Promise<COLUserProfile | null> {
  try {
    const snapshot = await getDoc(profileReference(uid));

    if (!snapshot.exists()) {
      return null;
    }

    return toProfile(uid, snapshot.data());
  } catch {
    throw new Error("Unable to load the user profile.");
  }
}

export async function updateUserProfile(
  uid: string,
  updates: {
    displayName?: string;
    bio?: string;
    location?: string | null;
    visibility?: ProfileVisibility;
    photoURL?: string | null;
  }
): Promise<void> {
  if (Object.keys(updates).length === 0) {
    throw new Error("No profile changes were provided.");
  }

  const safeUpdates: Record<string, unknown> = {};

  if (updates.displayName !== undefined) {
    safeUpdates.displayName = validateDisplayName(
      updates.displayName
    );
  }

  if (updates.bio !== undefined) {
    safeUpdates.bio = validateBio(updates.bio);
  }

  if (updates.location !== undefined) {
    const location = updates.location?.trim() ?? "";

    if (location.length > 100) {
      throw new Error("Location cannot exceed 100 characters.");
    }

    safeUpdates.location = location || null;
  }

  if (updates.visibility !== undefined) {
    if (
      updates.visibility !== "public" &&
      updates.visibility !== "private"
    ) {
      throw new Error("Invalid profile visibility.");
    }

    safeUpdates.visibility = updates.visibility;
  }

  if (updates.photoURL !== undefined) {
    safeUpdates.photoURL = updates.photoURL;
  }

  safeUpdates.updatedAt = serverTimestamp();

  try {
    await updateDoc(profileReference(uid), safeUpdates);
  } catch {
    throw new Error(
      "Unable to update your profile. Please try again."
    );
  }
}
