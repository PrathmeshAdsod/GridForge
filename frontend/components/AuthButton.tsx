"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mountTarget, setMountTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const placeholder = document.querySelector<HTMLButtonElement>('button[aria-label="Sign in"]');
    if (placeholder?.parentElement) {
      placeholder.style.display = "none";
      // The portal target only exists after the browser DOM has mounted.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMountTarget(placeholder.parentElement);
    }

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
      if (placeholder) placeholder.style.display = "";
    };
  }, []);

  async function signIn() {
    setBusy(true);
    setError(null);

    try {
      const supabase = createBrowserClient();
      const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
      const redirectTo = configuredSiteUrl || window.location.origin;

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
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

  if (!mountTarget) return null;

  const control = user ? (
    <button
      className="btn btn-ghost btn-sm"
      type="button"
      onClick={signOut}
      disabled={busy}
      title={error ?? `Signed in as ${(typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) || user.email || "Account"}. Click to sign out.`}
      aria-label="Sign out"
    >
      {busy
        ? "Signing out…"
        : (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) || user.email || "Account"}
    </button>
  ) : (
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

  return createPortal(control, mountTarget);
}
