import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";

export type CelebrationReaction =
  | "like"
  | "love"
  | "celebrate"
  | "party"
  | "applause";

export interface COLComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  text: string;
  createdAt: Timestamp | null;
}

export interface CommentPage {
  comments: COLComment[];
  lastDocument: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

const MAX_COMMENT_LENGTH = 1000;
const DEFAULT_PAGE_SIZE = 20;

function requireUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in to continue.");
  }

  return user;
}

function getPostReference(postId: string) {
  if (!postId.trim()) {
    throw new Error("A valid post ID is required.");
  }

  return doc(db, "posts", postId);
}

function getReactionReference(
  postId: string,
  uid: string
) {
  return doc(db, "posts", postId, "reactions", uid);
}

function getCommentReference(postId: string) {
  return collection(db, "posts", postId, "comments");
}

export async function setPostReaction(
  postId: string,
  reaction: CelebrationReaction | null
): Promise<void> {
  const user = requireUser();
  const postRef = getPostReference(postId);
  const reactionRef = getReactionReference(postId, user.uid);

  const allowedReactions: CelebrationReaction[] = [
    "like",
    "love",
    "celebrate",
    "party",
    "applause",
  ];

  if (reaction !== null && !allowedReactions.includes(reaction)) {
    throw new Error("Invalid celebration reaction.");
  }

  try {
    await runTransaction(db, async (transaction) => {
      const [postSnapshot, reactionSnapshot] = await Promise.all([
        transaction.get(postRef),
        transaction.get(reactionRef),
      ]);

      if (!postSnapshot.exists()) {
        throw new Error("This post no longer exists.");
      }

      const previousReaction = reactionSnapshot.exists()
        ? reactionSnapshot.data().type
        : null;

      if (previousReaction === reaction) {
        return;
      }

      if (reaction === null) {
        if (!reactionSnapshot.exists()) return;

        transaction.delete(reactionRef);
        transaction.update(postRef, {
          likeCount: Math.max(
            0,
            Number(postSnapshot.data().likeCount ?? 0) - 1
          ),
          updatedAt: serverTimestamp(),
        });

        return;
      }

      transaction.set(reactionRef, {
        userId: user.uid,
        type: reaction,
        updatedAt: serverTimestamp(),
      });

      if (!previousReaction) {
        transaction.update(postRef, {
          likeCount:
            Number(postSnapshot.data().likeCount ?? 0) + 1,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch {
    throw new Error(
      "Unable to update your reaction. Please try again."
    );
  }
}

export async function getMyPostReaction(
  postId: string
): Promise<CelebrationReaction | null> {
  const user = requireUser();
  const reactionRef = getReactionReference(postId, user.uid);

  try {
    const snapshot = await getDoc(reactionRef);

    if (!snapshot.exists()) return null;

    const type = snapshot.data().type;

    const allowed: CelebrationReaction[] = [
      "like",
      "love",
      "celebrate",
      "party",
      "applause",
    ];

    return allowed.includes(type) ? type : null;
  } catch {
    throw new Error("Unable to load your reaction.");
  }
}

export async function addComment(
  postId: string,
  textInput: string
): Promise<string> {
  const user = requireUser();
  const text = textInput.trim();

  if (!text) {
    throw new Error("Comment cannot be empty.");
  }

  if (text.length > MAX_COMMENT_LENGTH) {
    throw new Error("Comment cannot exceed 1000 characters.");
  }

  const postRef = getPostReference(postId);
  const commentsRef = getCommentReference(postId);
  const commentRef = doc(commentsRef);

  try {
    await runTransaction(db, async (transaction) => {
      const postSnapshot = await transaction.get(postRef);

      if (!postSnapshot.exists()) {
        throw new Error("This post no longer exists.");
      }

      transaction.set(commentRef, {
        postId,
        authorId: user.uid,
        authorName: user.displayName ?? "COL Member",
        authorPhotoURL: user.photoURL,
        text,
        createdAt: serverTimestamp(),
      });

      transaction.update(postRef, {
        commentCount:
          Number(postSnapshot.data().commentCount ?? 0) + 1,
        updatedAt: serverTimestamp(),
      });
    });

    return commentRef.id;
  } catch {
    throw new Error(
      "Unable to publish your comment. Please try again."
    );
  }
}

function mapComment(
  id: string,
  data: DocumentData
): COLComment {
  return {
    id,
    postId: String(data.postId ?? ""),
    authorId: String(data.authorId ?? ""),
    authorName: String(data.authorName ?? "COL Member"),
    authorPhotoURL:
      typeof data.authorPhotoURL === "string"
        ? data.authorPhotoURL
        : null,
    text: String(data.text ?? ""),
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt
        : null,
  };
}

export async function getPostComments(
  postId: string,
  lastDocument: QueryDocumentSnapshot<DocumentData> | null = null,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<CommentPage> {
  const safePageSize = Math.min(
    Math.max(Math.floor(pageSize), 1),
    50
  );

  try {
    const commentsRef = getCommentReference(postId);

    const constraints = [
      orderBy("createdAt", "desc"),
      ...(lastDocument ? [startAfter(lastDocument)] : []),
      limit(safePageSize + 1),
    ];

    const snapshot = await getDocs(
      query(commentsRef, ...constraints)
    );

    const hasMore = snapshot.docs.length > safePageSize;
    const documents = snapshot.docs.slice(0, safePageSize);

    return {
      comments: documents.map((item) =>
        mapComment(item.id, item.data())
      ),
      lastDocument:
        documents.length > 0
          ? documents[documents.length - 1]
          : null,
      hasMore,
    };
  } catch {
    throw new Error("Unable to load comments.");
  }
}
