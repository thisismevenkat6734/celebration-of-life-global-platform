import { useEffect, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import type {
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";

import {
  login,
  logout,
  resetPassword,
  observeAuthState,
} from "./services/auth.service";

import { registerCOLAccount } from "./services/account.service";

import {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  type COLUserProfile,
  type ProfileVisibility,
} from "./services/user.service";

import {
  createPost,
  getPublicFeed,
  type COLPost,
  type COLPostCategory,
} from "./services/post.service";

type AuthMode = "login" | "signup" | "reset";
type DashboardTab = "home" | "create" | "profile";

const categories: {
  value: COLPostCategory;
  label: string;
  emoji: string;
}[] = [
  { value: "birthday", label: "Birthday", emoji: "🎂" },
  { value: "wedding", label: "Wedding", emoji: "💍" },
  { value: "achievement", label: "Achievement", emoji: "🏆" },
  { value: "family", label: "Family", emoji: "👨‍👩‍👧‍👦" },
  { value: "friendship", label: "Friendship", emoji: "🤝" },
  { value: "travel", label: "Travel", emoji: "✈️" },
  { value: "festival", label: "Festival", emoji: "🎉" },
  { value: "graduation", label: "Graduation", emoji: "🎓" },
  { value: "other", label: "Other", emoji: "✨" },
];

function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<COLUserProfile | null>(null);

  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [visibility, setVisibility] =
    useState<ProfileVisibility>("public");

  const [tab, setTab] = useState<DashboardTab>("home");
  const [postText, setPostText] = useState("");
  const [postCategory, setPostCategory] =
    useState<COLPostCategory>("other");

  const [posts, setPosts] = useState<COLPost[]>([]);
  const [lastDocument, setLastDocument] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const unsubscribe = observeAuthState((currentUser) => {
      setUser(currentUser);
      setProfile(null);
      setPosts([]);
      setLastDocument(null);
      setHasMore(false);
      setProfileLoading(true);
      setError("");
      setSuccess("");
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      try {
        let currentProfile = await getUserProfile(user.uid);

        if (!currentProfile) {
          currentProfile = await createUserProfile(user);
        }

        if (active) {
          setProfile(currentProfile);
          setName(currentProfile.displayName);
          setBio(currentProfile.bio);
          setLocation(currentProfile.location ?? "");
          setVisibility(currentProfile.visibility);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your profile."
          );
        }
      } finally {
        if (active) {
          setProfileLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [user]);

  async function loadFeed(reset = false) {
    if (feedLoading) return;

    setFeedLoading(true);
    setError("");

    try {
      const page = await getPublicFeed(
        reset ? null : lastDocument,
        10
      );

      setPosts((previous) =>
        reset ? page.posts : [...previous, ...page.posts]
      );

      setLastDocument(page.lastDocument);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the celebration feed."
      );
    } finally {
      setFeedLoading(false);
    }
  }

  useEffect(() => {
    if (user && profile?.profileSetupCompleted) {
      void loadFeed(true);
    }
    // Load the first page when the authenticated profile becomes ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, profile?.profileSetupCompleted]);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "signup") {
        const result = await registerCOLAccount({
          displayName: name.trim(),
          email: email.trim(),
          password,
        });

        if (!result.profileCreated) {
          setSuccess(
            "Your account was created. We will retry loading your profile."
          );
        }
      } else if (mode === "login") {
        await login({
          email: email.trim(),
          password,
        });
      } else {
        await resetPassword(email.trim());

        setSuccess(
          "If an account exists for this email, password reset instructions will be sent."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileSetup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await updateUserProfile(user.uid, {
        displayName: name.trim(),
        bio: bio.trim(),
        location: location.trim() || null,
        visibility,
        completeSetup: true,
      });

      const updatedProfile = await getUserProfile(user.uid);

      if (!updatedProfile) {
        throw new Error("Profile could not be reloaded.");
      }

      setProfile(updatedProfile);
      setSuccess("Your COL profile is ready!");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your profile."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || !profile) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await createPost({
        text: postText.trim(),
        category: postCategory,
      });

      setPostText("");
      setPostCategory("other");
      setTab("home");

      await loadFeed(true);
      setSuccess("Your celebration was published!");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to publish your celebration."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setError("");

    try {
      await logout();
      setProfile(null);
      setPosts([]);
      setSuccess("You have signed out.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign out."
      );
    } finally {
      setLoading(false);
    }
  }

  function Brand() {
    return (
      <a className="col-brand" href="#home">
        <span className="col-logo">C</span>
        <span>
          <strong>COL</strong>
          <small>Celebration of Life</small>
        </span>
      </a>
    );
  }

  function Navigation() {
    const items: {
      id: DashboardTab;
      label: string;
      emoji: string;
    }[] = [
      { id: "home", label: "Home", emoji: "🏠" },
      { id: "create", label: "Celebrate", emoji: "✨" },
      { id: "profile", label: "Profile", emoji: "👤" },
    ];

    return (
      <nav
        aria-label="Main navigation"
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          margin: "20px 0",
        }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              tab === item.id
                ? "col-button primary"
                : "col-button secondary"
            }
            onClick={() => {
              setTab(item.id);
              setError("");
              setSuccess("");
            }}
          >
            {item.emoji} {item.label}
          </button>
        ))}
      </nav>
    );
  }

  if (user && profileLoading) {
    return (
      <main className="col-app">
        <header className="col-header">
          <Brand />
        </header>

        <section className="col-auth-card">
          <h2>Preparing your COL experience...</h2>
          <p>Please wait while we load your profile.</p>
          {error && (
            <p className="col-message error" role="alert">
              {error}
            </p>
          )}
        </section>
      </main>
    );
  }

  if (user && profile && !profile.profileSetupCompleted) {
    return (
      <main className="col-app">
        <header className="col-header">
          <Brand />
          <button
            className="col-button secondary"
            onClick={handleLogout}
            disabled={loading}
          >
            Sign out
          </button>
        </header>

        <section className="col-auth-layout">
          <section className="col-auth-card">
            <div className="col-card-heading">
              <p className="col-eyebrow">WELCOME TO COL</p>
              <h2>Build your profile</h2>
              <p>
                Tell the world a little about yourself.
                You can change these details later.
              </p>
            </div>

            <form onSubmit={handleProfileSetup}>
              <label className="col-field">
                Your display name
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  maxLength={50}
                  required
                />
              </label>

              <label className="col-field">
                About you
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Share something about yourself..."
                  maxLength={300}
                  rows={4}
                />
              </label>

              <label className="col-field">
                Location (optional)
                <input
                  type="text"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="City or country"
                  maxLength={100}
                />
              </label>

              <label className="col-field">
                Profile visibility
                <select
                  value={visibility}
                  onChange={(event) =>
                    setVisibility(
                      event.target.value as ProfileVisibility
                    )
                  }
                >
                  <option value="public">Public profile</option>
                  <option value="private">Private profile</option>
                </select>
              </label>

              {error && (
                <p className="col-message error" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="col-button primary full"
                disabled={loading}
              >
                {loading ? "Saving profile..." : "Complete profile"}
              </button>
            </form>
          </section>
        </section>
      </main>
    );
  }

  if (user && profile) {
    return (
      <main className="col-app">
        <header className="col-header">
          <Brand />

          <button
            className="col-button secondary"
            onClick={handleLogout}
            disabled={loading}
          >
            {loading ? "Please wait..." : "Sign out"}
          </button>
        </header>

        <section className="col-welcome" id="home">
          <div className="col-sparkle">✦</div>
          <p className="col-eyebrow">YOUR WORLD OF HAPPY MOMENTS</p>
          <h1>
            Welcome to
            <br />
            COL, <span>{profile.displayName}.</span>
          </h1>
          <p className="col-description">
            Every moment deserves a place to shine.
          </p>
        </section>

        <section className="col-auth-card">
          <Navigation />

          {error && (
            <p className="col-message error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="col-message success" role="status">
              {success}
            </p>
          )}

          {tab === "home" && (
            <>
              <div className="col-card-heading">
                <p className="col-eyebrow">COL COMMUNITY</p>
                <h2>Celebration Feed</h2>
                <p>Discover and celebrate life's happy moments.</p>
              </div>

              <button
                type="button"
                className="col-button primary"
                onClick={() => setTab("create")}
              >
                ✨ Share a celebration
              </button>

              <div style={{ marginTop: 24 }}>
                {posts.length === 0 && !feedLoading && (
                  <p>
                    No public celebrations are available yet.
                    Be among the first to share a happy moment!
                  </p>
                )}

                {posts.map((post) => {
                  const category = categories.find(
                    (item) => item.value === post.category
                  );

                  return (
                    <article
                      key={post.id}
                      className="col-auth-card"
                      style={{ margin: "18px 0", padding: 20 }}
                    >
                      <p className="col-eyebrow">
                        {category?.emoji ?? "✨"}{" "}
                        {category?.label ?? "Celebration"}
                      </p>

                      <h3>{post.authorName}</h3>

                      <p style={{ whiteSpace: "pre-wrap" }}>
                        {post.text}
                      </p>

                      {post.media.map((media, index) => (
                        media.type === "image" ? (
                          <img
                            key={`${post.id}-${index}`}
                            src={media.url}
                            alt="Celebration"
                            loading="lazy"
                            style={{
                              width: "100%",
                              borderRadius: 14,
                              marginTop: 12,
                            }}
                          />
                        ) : (
                          <video
                            key={`${post.id}-${index}`}
                            src={media.url}
                            controls
                            preload="metadata"
                            style={{
                              width: "100%",
                              borderRadius: 14,
                              marginTop: 12,
                            }}
                          />
                        )
                      ))}

                      <p className="col-status">
                        ❤️ {post.likeCount} · 💬 {post.commentCount}
                      </p>
                    </article>
                  );
                })}

                {feedLoading && <p>Loading celebrations...</p>}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="col-button secondary"
                    onClick={() => void loadFeed(true)}
                    disabled={feedLoading}
                  >
                    Refresh feed
                  </button>

                  {hasMore && (
                    <button
                      type="button"
                      className="col-button secondary"
                      onClick={() => void loadFeed(false)}
                      disabled={feedLoading}
                    >
                      Load more
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === "create" && (
            <>
              <div className="col-card-heading">
                <p className="col-eyebrow">SHARE YOUR HAPPINESS</p>
                <h2>Create a celebration</h2>
                <p>Tell the COL community about your happy moment.</p>
              </div>

              <form onSubmit={handleCreatePost}>
                <label className="col-field">
                  Celebration category
                  <select
                    value={postCategory}
                    onChange={(event) =>
                      setPostCategory(
                        event.target.value as COLPostCategory
                      )
                    }
                  >
                    {categories.map((category) => (
                      <option
                        key={category.value}
                        value={category.value}
                      >
                        {category.emoji} {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="col-field">
                  Your story
                  <textarea
                    value={postText}
                    onChange={(event) => setPostText(event.target.value)}
                    placeholder="What beautiful moment would you like to celebrate?"
                    maxLength={3000}
                    rows={6}
                  />
                </label>

                <p className="col-status">
                  {postText.length}/3000 characters
                </p>

                <button
                  type="submit"
                  className="col-button primary full"
                  disabled={loading || !postText.trim()}
                >
                  {loading ? "Publishing..." : "Publish celebration"}
                </button>
              </form>

              <p className="col-status">
                Text-only publishing is enabled in this step.
                Photo and video uploads will be connected separately.
              </p>
            </>
          )}

          {tab === "profile" && (
            <>
              <div className="col-card-heading">
                <p className="col-eyebrow">YOUR COL ACCOUNT</p>
                <h2>Your profile</h2>
              </div>

              <p><strong>Name:</strong> {profile.displayName}</p>
              <p><strong>Email:</strong> {profile.email}</p>
              <p><strong>About:</strong> {profile.bio || "Not added yet"}</p>
              <p><strong>Location:</strong> {profile.location || "Not added"}</p>
              <p><strong>Visibility:</strong> {profile.visibility}</p>
              <p><strong>Account:</strong> Active</p>

              <button
                type="button"
                className="col-button secondary"
                onClick={handleLogout}
                disabled={loading}
              >
                Sign out
              </button>
            </>
          )}
        </section>

        <footer className="col-footer">
          <strong>COL – Celebration of Life</strong>
          <span>Every Moment. Every Memory. Every Life.</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="col-app">
      <header className="col-header">
        <Brand />
        <span className="col-header-caption">
          A World of Happy Moments
        </span>
      </header>

      <section className="col-auth-layout">
        <div className="col-welcome">
          <div className="col-sparkle">✦</div>
          <p className="col-eyebrow">
            CELEBRATE THE BEAUTIFUL SIDE OF LIFE
          </p>

          <h1>
            Every moment
            <br />
            deserves to <span>shine.</span>
          </h1>

          <p className="col-description">
            Your birthdays, achievements, family memories,
            friendships and life's beautiful celebrations
            deserve a place in the world.
          </p>

          <div className="col-highlights">
            <span>🎉 Celebrate</span>
            <span>❤️ Connect</span>
            <span>🌍 Share happiness</span>
          </div>
        </div>

        <section className="col-auth-card">
          <div className="col-card-heading">
            <p className="col-eyebrow">YOUR WORLD OF MEMORIES</p>

            <h2>
              {mode === "signup"
                ? "Create your account"
                : mode === "reset"
                  ? "Reset your password"
                  : "Welcome back"}
            </h2>

            <p>
              {mode === "signup"
                ? "Join COL and celebrate life's moments."
                : mode === "reset"
                  ? "We'll help you regain access to your account."
                  : "Sign in to continue your COL journey."}
            </p>
          </div>

          <div className="col-mode-switch">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => changeMode("login")}
            >
              Login
            </button>

            <button
              type="button"
              className={mode === "signup" ? "active" : ""}
              onClick={() => changeMode("signup")}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "signup" && (
              <label className="col-field">
                Your name
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  minLength={2}
                  maxLength={50}
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label className="col-field">
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            {mode !== "reset" && (
              <label className="col-field">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  maxLength={128}
                  autoComplete={
                    mode === "signup"
                      ? "new-password"
                      : "current-password"
                  }
                  required
                />
              </label>
            )}

            {mode === "login" && (
              <button
                type="button"
                className="col-forgot"
                onClick={() => changeMode("reset")}
              >
                Forgot password?
              </button>
            )}

            {error && (
              <p className="col-message error" role="alert">
                {error}
              </p>
            )}

            {success && (
              <p className="col-message success" role="status">
                {success}
              </p>
            )}

            <button
              type="submit"
              className="col-button primary full"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "signup"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset instructions"
                    : "Sign in"}
            </button>
          </form>

          {mode === "reset" && (
            <button
              type="button"
              className="col-back"
              onClick={() => changeMode("login")}
            >
              ← Back to login
            </button>
          )}

          {mode !== "reset" && (
            <p className="col-switch-text">
              {mode === "login"
                ? "New to COL?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() =>
                  changeMode(mode === "login" ? "signup" : "login")
                }
              >
                {mode === "login" ? "Create account" : "Sign in"}
              </button>
            </p>
          )}

          <p className="col-legal">
            By continuing, you agree to COL's Terms & Conditions
            and Privacy Policy.
          </p>
        </section>
      </section>

      <footer className="col-footer">
        <strong>COL – Celebration of Life</strong>
        <span>Every Moment. Every Memory. Every Life.</span>
      </footer>
    </main>
  );
}

export default App;
