import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from "firebase/auth";

import { auth, authPersistence } from "../lib/firebase";

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): void {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new Error("Please enter a valid email address.");
  }
}

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }

  if (password.length > 128) {
    throw new Error("Password must not exceed 128 characters.");
  }
}

function getAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error
      ? String(error.code)
      : "";

  const messages: Record<string, string> = {
    "auth/email-already-in-use":
      "An account already exists with this email address.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/weak-password":
      "Your password is too weak. Please choose a stronger password.",

    "auth/user-not-found":
      "No account was found with these details.",

    "auth/wrong-password":
      "The email or password is incorrect.",

    "auth/invalid-credential":
      "The email or password is incorrect.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later.",

    "auth/network-request-failed":
      "Network error. Please check your internet connection.",

    "auth/user-disabled":
      "This account has been disabled.",

    "auth/operation-not-allowed":
      "This authentication method is currently unavailable.",

    "auth/invalid-api-key":
      "Authentication configuration is invalid.",

    "auth/unauthorized-domain":
      "This website domain is not authorized in Firebase.",
  };

  return (
    messages[code] ??
    "Something went wrong. Please try again."
  );
}

async function prepareAuthentication(): Promise<void> {
  await authPersistence;
}

export async function signup(
  input: SignupInput
): Promise<User> {
  const displayName = input.displayName.trim();
  const email = normalizeEmail(input.email);

  if (displayName.length < 2 || displayName.length > 50) {
    throw new Error("Name must contain between 2 and 50 characters.");
  }

  validateEmail(email);
  validatePassword(input.password);

  try {
    await prepareAuthentication();

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      input.password
    );

    await updateProfile(credential.user, {
      displayName,
    });

    return credential.user;
  } catch (error) {
    if (error instanceof Error && !("code" in error)) {
      throw error;
    }

    throw new Error(getAuthErrorMessage(error));
  }
}

export async function login(
  input: LoginInput
): Promise<User> {
  const email = normalizeEmail(input.email);

  validateEmail(email);

  if (!input.password) {
    throw new Error("Please enter your password.");
  }

  try {
    await prepareAuthentication();

    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      input.password
    );

    return credential.user;
  } catch (error) {
    if (error instanceof Error && !("code" in error)) {
      throw error;
    }

    throw new Error(getAuthErrorMessage(error));
  }
}

export async function logout(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

export async function resetPassword(
  emailInput: string
): Promise<void> {
  const email = normalizeEmail(emailInput);

  validateEmail(email);

  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

export async function updateUserDisplayName(
  user: User,
  displayNameInput: string
): Promise<void> {
  const displayName = displayNameInput.trim();

  if (displayName.length < 2 || displayName.length > 50) {
    throw new Error("Name must contain between 2 and 50 characters.");
  }

  try {
    await updateProfile(user, {
      displayName,
    });
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

export function observeAuthState(
  callback: (user: User | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}
