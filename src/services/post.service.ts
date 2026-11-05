import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";

export type COLPostCategory =
  | "birthday"
  | "wedding"
  | "achievement"
  | "family"
  | "friendship"
  | "travel"
  | "festival"
  | "graduation"
  | "other";

export interface COLPostInput {
  text: string;
  category: COLPostCategory;
  media?: {
    type: "image" | "video";
    url: string;
    publicId: string;
  }[];
}

export interface COLPost {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  text: string;
  category: COLPostCategory;
  media: {
    type: "image" | "video";
    url: string;
    publicId: string;
  }[];
  visibility: "public";
  createdAt: Timestamp | null;
  likeCount: number;
  commentCount: number;
}

export interface COLPostPage {
  posts: COLPost[];
  lastDocument: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

const POSTS_COLLECTION = "posts";
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 30;
const MAX_TEXT_LENGTH = 3000;
const MAX_MEDIA_ITEMS = 10;

function validatePost(input: COLPostInput): void {
  const text = input.text.trim();
  const media = input.media ?? [];

  if (!text && media.length === 0) {
    throw new Error("Add text or media before publishing.");
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error("Post text cannot exceed 3000 characters.");
  }

  if (media.length > MAX_MEDIA_ITEMS) {
    throw new Error("A post can contain up to 10 media items.");
  }

  for (const item of media) {
    if (
      !["image", "video"].includes(item.type) ||
      !item.url.trim() ||
      !item.publicId.trim()
    ) {
      throw new Error("Post contains invalid media information.");
    }

    try {
      const parsedUrl = new URL(item.url);

      if (parsedUrl.protocol !== "https:") {
        throw new Error("Invalid media protocol.");
      }
    } catch {
      throw new Error("A valid HTTPS media URL is required.");
    }
  }

  const categories: COLPostCategory[] = [
    "birthday",
    "wedding",
    "achievement",
    "family",
    "friendship",
    "travel",
    "festival",
    "graduation",
    "other",
  ];

  if (!categories.includes(input.category)) {
    throw new Error("Please select a valid celebration category.");
  }
}

function mapPost(id: string, data: DocumentData): COLPost {
  return {
    id,
    authorId: String(data.authorId ?? ""),
    authorName: String(data.authorName ?? "COL Member"),
    authorPhotoURL:
      typeof data.authorPhotoURL === "string"
        ? data.authorPhotoURL
        : null,
    text: String(data.text ?? ""),
    category: data.category as COLPostCategory,
    media: Array.isArray(data.media) ? data.media : [],
    visibility: "public",
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt
        : null,
    likeCount: Number(data.likeCount ?? 0),
    commentCount: Number(data.commentCount ?? 0),
  };
}

export async function createPost(
  input: COLPostInput
): Promise<string> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in before creating a post.");
  }

  validatePost(input);

  const postData = {
    authorId: user.uid,
    authorName: user.displayName ?? "COL Member",
    authorPhotoURL: user.photoURL,
    text: input.text.trim(),
    category: input.category,
    media: input.media ?? [],
    visibility: "public",
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const reference = await addDoc(
      collection(db, POSTS_COLLECTION),
      postData
    );

    return reference.id;
  } catch {
    throw new Error(
      "Your post could not be published. Please try again."
    );
  }
}

export async function getPublicFeed(
  lastDocument: QueryDocumentSnapshot<DocumentData> | null = null,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<COLPostPage> {
  const safePageSize = Math.min(
    Math.max(Math.floor(pageSize), 1),
    MAX_PAGE_SIZE
  );

  try {
    const postsReference = collection(db, POSTS_COLLECTION);

    const constraints = [
      where("visibility", "==", "public"),
      orderBy("createdAt", "desc"),
      ...(lastDocument ? [startAfter(lastDocument)] : []),
      limit(safePageSize + 1),
    ];

    const feedQuery = query(postsReference, ...constraints);
    const snapshot = await getDocs(feedQuery);

    const hasMore = snapshot.docs.length > safePageSize;
    const pageDocuments = snapshot.docs.slice(0, safePageSize);

    const finalDocument =
      pageDocuments[pageDocuments.length - 1] ?? null;

    return {
      posts: pageDocuments.map((document) =>
        mapPost(document.id, document.data())
      ),
      lastDocument: finalDocument,
      hasMore,
    };
  } catch {
    throw new Error(
      "Unable to load the public feed. Please try again."
    );
  }
}
