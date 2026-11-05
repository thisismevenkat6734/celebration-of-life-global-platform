import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";

export type ReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "violence"
  | "nudity"
  | "false_information"
  | "copyright"
  | "other";

export type ReportTargetType = "user" | "post" | "comment";

const VALID_REASONS: ReportReason[] = [
  "spam",
  "harassment",
  "hate",
  "violence",
  "nudity",
  "false_information",
  "copyright",
  "other",
];

function requireUser(): string {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    throw new Error("Please sign in to continue.");
  }

  return uid;
}

function validateTarget(targetId: string): void {
  if (!targetId || !targetId.trim()) {
    throw new Error("A valid target ID is required.");
  }

  if (targetId.length > 150) {
    throw new Error("Invalid target ID.");
  }
}

function blockReference(
  currentUid: string,
  targetUid: string
) {
  return doc(
    db,
    "users",
    currentUid,
    "blockedUsers",
    targetUid
  );
}

export async function blockUser(
  targetUid: string
): Promise<void> {
  const currentUid = requireUser();

  validateTarget(targetUid);

  if (currentUid === targetUid) {
    throw new Error("You cannot block your own account.");
  }

  try {
    const targetProfile = await getDoc(
      doc(db, "users", targetUid)
    );

    if (!targetProfile.exists()) {
      throw new Error("User profile not found.");
    }

    await setDoc(
      blockReference(currentUid, targetUid),
      {
        blockedUserId: targetUid,
        createdAt: serverTimestamp(),
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "User profile not found."
    ) {
      throw error;
    }

    throw new Error("Unable to block this user.");
  }
}

export async function unblockUser(
  targetUid: string
): Promise<void> {
  const currentUid = requireUser();

  validateTarget(targetUid);

  try {
    await deleteDoc(
      blockReference(currentUid, targetUid)
    );
  } catch {
    throw new Error("Unable to unblock this user.");
  }
}

export async function isUserBlocked(
  targetUid: string
): Promise<boolean> {
  const currentUid = requireUser();

  validateTarget(targetUid);

  try {
    const [myBlock, theirBlock] = await Promise.all([
      getDoc(blockReference(currentUid, targetUid)),
      getDoc(blockReference(targetUid, currentUid)),
    ]);

    return myBlock.exists() || theirBlock.exists();
  } catch {
    throw new Error("Unable to check block status.");
  }
}

export async function getBlockedUserIds(): Promise<string[]> {
  const currentUid = requireUser();

  try {
    const blockedCollection = collection(
      db,
      "users",
      currentUid,
      "blockedUsers"
    );

    const snapshot = await getDocs(
      query(blockedCollection, limit(500))
    );

    return snapshot.docs.map((item) => item.id);
  } catch {
    throw new Error("Unable to load blocked users.");
  }
}

export async function reportContent(input: {
  targetId: string;
  targetType: ReportTargetType;
  reason: ReportReason;
  details?: string;
}): Promise<string> {
  const currentUid = requireUser();

  validateTarget(input.targetId);

  if (!["user", "post", "comment"].includes(input.targetType)) {
    throw new Error("Invalid report type.");
  }

  if (!VALID_REASONS.includes(input.reason)) {
    throw new Error("Please select a valid report reason.");
  }

  const details = input.details?.trim() ?? "";

  if (details.length > 1000) {
    throw new Error("Report details cannot exceed 1000 characters.");
  }

  try {
    const reportsCollection = collection(db, "reports");

    const reportReference = doc(reportsCollection);

    await setDoc(reportReference, {
      reportId: reportReference.id,
      reporterId: currentUid,
      targetId: input.targetId,
      targetType: input.targetType,
      reason: input.reason,
      details,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    return reportReference.id;
  } catch {
    throw new Error(
      "Unable to submit your report. Please try again."
    );
  }
}
