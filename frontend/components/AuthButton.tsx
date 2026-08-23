"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    let mounted = true;

    supabase.auth.getUser().then(({ data, error: getUserError }) => {
      if (!mounted) return;
      if (getUserError) setError(getUserError.message);
      setUser(data.user ?? null);
      setBusy(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setBusy(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn() {
    setBusy(true);
    setError(null);

    try {
      const supabase = createBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (signInError) {
        setError(signInError.message);
        setBusy(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start sign in");
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError(null);

    try {
      const supabase = createBrowserClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) setError(signOutError.message);
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    const label =
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
      user.email ||
      "Account";

    return (
      <button
        className="btn btn-ghost btn-sm"
        type="button"
        onClick={signOut}
        disabled={busy}
        title={error ?? `Signed in as ${label}. Click to sign out.`}
        aria-label="Sign out"
      >
        {busy ? "Signing out…" : label}
      </button>
    );
  }

  return (
    <button
      className="btn btn-ghost btn-sm"
      type="button"
      onClick={signIn}
      disabled={busy}
      title={error ?? "Sign in with Google"}
      aria-label="Sign in with Google"
    >
      {busy ? "Checking…" : error ? "Retry sign in" : "Sign in"}
    </button>
  );
}
