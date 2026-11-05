
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  increment,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";

export interface FollowStatus {
  following: boolean;
  followerId: string;
  targetId: string;
}

function requireCurrentUser(): string {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    throw new Error("Please sign in to continue.");
  }

  return uid;
}

function validateTarget(targetUid: string, currentUid: string) {
  if (!targetUid || targetUid.trim().length === 0) {
    throw new Error("A valid user ID is required.");
  }

  if (targetUid === currentUid) {
    throw new Error("You cannot follow your own account.");
  }
}

export async function followUser(
  targetUid: string
): Promise<void> {
  const currentUid = requireCurrentUser();

  validateTarget(targetUid, currentUid);

  const currentProfileRef = doc(db, "users", currentUid);
  const targetProfileRef = doc(db, "users", targetUid);

  const followingRef = doc(
    db,
    "users",
    currentUid,
    "following",
    targetUid
  );

  const followerRef = doc(
    db,
    "users",
    targetUid,
    "followers",
    currentUid
  );

  try {
    await runTransaction(db, async (transaction) => {
      const [
        currentProfile,
        targetProfile,
        existingFollowing,
        existingFollower,
      ] = await Promise.all([
        transaction.get(currentProfileRef),
        transaction.get(targetProfileRef),
        transaction.get(followingRef),
        transaction.get(followerRef),
      ]);

      if (!currentProfile.exists() || !targetProfile.exists()) {
        throw new Error("User profile not found.");
      }

      if (existingFollowing.exists() || existingFollower.exists()) {
        return;
      }

      const targetVisibility =
        targetProfile.data().visibility ?? "public";

      if (targetVisibility !== "public") {
        throw new Error(
          "This account is private. A follow request is required."
        );
      }

      transaction.set(followingRef, {
        userId: targetUid,
        createdAt: serverTimestamp(),
      });

      transaction.set(followerRef, {
        userId: currentUid,
        createdAt: serverTimestamp(),
      });

      transaction.update(currentProfileRef, {
        followingCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      transaction.update(targetProfileRef, {
        followerCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "This account is private. A follow request is required."
    ) {
      throw error;
    }

    throw new Error("Unable to follow this account. Please try again.");
  }
}

export async function unfollowUser(
  targetUid: string
): Promise<void> {
  const currentUid = requireCurrentUser();

  validateTarget(targetUid, currentUid);

  const currentProfileRef = doc(db, "users", currentUid);
  const targetProfileRef = doc(db, "users", targetUid);

  const followingRef = doc(
    db,
    "users",
    currentUid,
    "following",
    targetUid
  );

  const followerRef = doc(
    db,
    "users",
    targetUid,
    "followers",
    currentUid
  );

  try {
    await runTransaction(db, async (transaction) => {
      const [
        currentProfile,
        targetProfile,
        existingFollowing,
        existingFollower,
      ] = await Promise.all([
        transaction.get(currentProfileRef),
        transaction.get(targetProfileRef),
        transaction.get(followingRef),
        transaction.get(followerRef),
      ]);

      if (!existingFollowing.exists() && !existingFollower.exists()) {
        return;
      }

      transaction.delete(followingRef);
      transaction.delete(followerRef);

      if (currentProfile.exists()) {
        transaction.update(currentProfileRef, {
          followingCount: increment(-1),
          updatedAt: serverTimestamp(),
        });
      }

      if (targetProfile.exists()) {
        transaction.update(targetProfileRef, {
          followerCount: increment(-1),
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch {
    throw new Error("Unable to unfollow this account. Please try again.");
  }
}

export async function getFollowStatus(
  targetUid: string
): Promise<FollowStatus> {
  const currentUid = requireCurrentUser();

  validateTarget(targetUid, currentUid);

  const followingRef = doc(
    db,
    "users",
    currentUid,
    "following",
    targetUid
  );

  try {
    const snapshot = await getDoc(followingRef);

    return {
      following: snapshot.exists(),
      followerId: currentUid,
      targetId: targetUid,
    };
  } catch {
    throw new Error("Unable to check follow status.");
  }
}
