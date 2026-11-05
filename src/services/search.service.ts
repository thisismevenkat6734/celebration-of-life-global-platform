import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";

export interface COLSearchUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  bio: string;
  location: string | null;
}

const MAX_RESULTS = 20;

function mapSearchUser(
  id: string,
  data: DocumentData
): COLSearchUser {
  return {
    uid: id,
    displayName: String(data.displayName ?? ""),
    photoURL:
      typeof data.photoURL === "string"
        ? data.photoURL
        : null,
    bio: String(data.bio ?? ""),
    location:
      typeof data.location === "string"
        ? data.location
        : null,
  };
}

export async function searchPublicUsers(
  searchInput: string,
  resultLimit = MAX_RESULTS
): Promise<COLSearchUser[]> {
  const currentUid = auth.currentUser?.uid ?? null;
  const searchTerm = searchInput.trim();

  if (searchTerm.length < 2) {
    return [];
  }

  if (searchTerm.length > 50) {
    throw new Error("Search text is too long.");
  }

  const safeLimit = Math.min(
    Math.max(Math.floor(resultLimit), 1),
    MAX_RESULTS
  );

  try {
    const usersReference = collection(db, "users");

    const usersQuery = query(
      usersReference,
      where("visibility", "==", "public"),
      where("displayName", ">=", searchTerm),
      where("displayName", "<=", searchTerm + "\uf8ff"),
      orderBy("displayName"),
      limit(safeLimit)
    );

    const snapshot = await getDocs(usersQuery);

    return snapshot.docs
      .filter((item) => item.id !== currentUid)
      .map((item) => mapSearchUser(item.id, item.data()));
  } catch {
    throw new Error(
      "Unable to search users. Please try again."
    );
  }
}
