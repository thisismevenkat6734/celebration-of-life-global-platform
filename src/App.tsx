import { useEffect, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import {
  signup,
  login,
  logout,
  resetPassword,
  observeAuthState,
} from "./services/auth.service";

type AuthMode = "login" | "signup" | "reset";

function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const unsubscribe = observeAuthState(setUser);
    return unsubscribe;
  }, []);

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
        await signup({
          displayName: name,
          email,
          password,
        });

        setSuccess("Your COL account has been created.");
      } else if (mode === "login") {
        await login({ email, password });
      } else {
        await resetPassword(email);
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

  async function handleLogout() {
    setLoading(true);
    setError("");

    try {
      await logout();
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

  if (user) {
    return (
      <main className="col-app">
        <header className="col-header">
          <a className="col-brand" href="#home">
            <span className="col-logo">C</span>
            <span>
              <strong>COL</strong>
              <small>Celebration of Life</small>
            </span>
          </a>
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
          <p className="col-eyebrow">WELCOME TO COL</p>
          <h1>
            Every moment
            <br />
            deserves to <span>shine.</span>
          </h1>
          <p className="col-description">
            Welcome, {user.displayName || "COL Member"}.
            Your account is connected to Celebration of Life.
          </p>
          <p className="col-account">
            Signed in as {user.email}
          </p>
          <p className="col-status">
            Your authentication session is active.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="col-app">
      <header className="col-header">
        <a className="col-brand" href="#home">
          <span className="col-logo">C</span>
          <span>
            <strong>COL</strong>
            <small>Celebration of Life</small>
          </span>
        </a>

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
