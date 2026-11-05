import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
  type DocumentData,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";

export type COLNotificationType =
  | "follow"
  | "follow_request"
  | "like"
  | "reaction"
  | "comment"
  | "mention"
  | "system";

export interface COLNotification {
  id: string;
  recipientId: string;
  actorId: string | null;
  actorName: string;
  actorPhotoURL: string | null;
  type: COLNotificationType;
  message: string;
  resourceId: string | null;
  read: boolean;
  createdAt: Timestamp | null;
}

export interface NotificationSubscription {
  unsubscribe: Unsubscribe;
}

const NOTIFICATION_LIMIT = 50;

function requireUser(): string {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    throw new Error("Please sign in to view notifications.");
  }

  return uid;
}

function mapNotification(
  snapshot: QueryDocumentSnapshot<DocumentData>
): COLNotification {
  const data = snapshot.data();

  const allowedTypes: COLNotificationType[] = [
    "follow",
    "follow_request",
    "like",
    "reaction",
    "comment",
    "mention",
    "system",
  ];

  const type = allowedTypes.includes(data.type)
    ? data.type
    : "system";

  return {
    id: snapshot.id,
    recipientId: String(data.recipientId ?? ""),
    actorId:
      typeof data.actorId === "string"
        ? data.actorId
        : null,
    actorName: String(data.actorName ?? "COL"),
    actorPhotoURL:
      typeof data.actorPhotoURL === "string"
        ? data.actorPhotoURL
        : null,
    type,
    message: String(data.message ?? ""),
    resourceId:
      typeof data.resourceId === "string"
        ? data.resourceId
        : null,
    read: data.read === true,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt
        : null,
  };
}

export function subscribeToNotifications(
  onNotifications: (items: COLNotification[]) => void,
  onError?: (error: Error) => void
): NotificationSubscription {
  const uid = requireUser();

  const notificationsRef = collection(
    db,
    "users",
    uid,
    "notifications"
  );

  const notificationsQuery = query(
    notificationsRef,
    orderBy("createdAt", "desc"),
    limit(NOTIFICATION_LIMIT)
  );

  const unsubscribe = onSnapshot(
    notificationsQuery,
    (snapshot) => {
      onNotifications(
        snapshot.docs.map(mapNotification)
      );
    },
    () => {
      onError?.(
        new Error("Unable to load notifications.")
      );
    }
  );

  return { unsubscribe };
}

export async function markNotificationAsRead(
  notificationId: string
): Promise<void> {
  const uid = requireUser();

  if (!notificationId.trim()) {
    throw new Error("A valid notification ID is required.");
  }

  try {
    const notificationRef = doc(
      db,
      "users",
      uid,
      "notifications",
      notificationId
    );

    await updateDoc(notificationRef, {
      read: true,
    });
  } catch {
    throw new Error(
      "Unable to update notification status."
    );
  }
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const uid = requireUser();

  const notificationsRef = collection(
    db,
    "users",
    uid,
    "notifications"
  );

  try {
    const snapshot = await import("firebase/firestore").then(
      ({ getDocs }) =>
        getDocs(
          query(
            notificationsRef,
            where("read", "==", false),
            limit(500)
          )
        )
    );

    if (snapshot.empty) return;

    const batch = writeBatch(db);

    snapshot.docs.forEach((notification) => {
      batch.update(notification.ref, {
        read: true,
      });
    });

    await batch.commit();
  } catch {
    throw new Error(
      "Unable to mark notifications as read."
    );
  }
}
