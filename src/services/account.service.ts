
import type { User } from "firebase/auth";

import {
  signup,
  type SignupInput,
} from "./auth.service";

import { createUserProfile } from "./user.service";

export interface AccountCreationResult {
  user: User;
  profileCreated: boolean;
}

export async function registerCOLAccount(
  input: SignupInput
): Promise<AccountCreationResult> {
  // Create the Firebase Authentication account.
  const user = await signup(input);

  try {
    // Create the corresponding Firestore user profile.
    await createUserProfile(user);

    return {
      user,
      profileCreated: true,
    };
  } catch {
    // The Authentication account remains available.
    // The profile can be created again after permissions
    // or network connectivity are restored.
    return {
      user,
      profileCreated: false,
    };
  }
}
