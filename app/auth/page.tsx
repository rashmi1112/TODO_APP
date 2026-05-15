"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const DOMAIN = "@things-todo.app";

function toEmail(username: string) {
  return `${username.toLowerCase().trim()}${DOMAIN}`;
}

function sanitize(value: string) {
  // Strip anything that looks like an email domain being auto-filled
  return value.replace(/@.*$/, "").trim();
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanUsername = sanitize(username);
    if (!cleanUsername || !password) {
      setError("Please fill in both fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const email = toEmail(cleanUsername);

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      // Auto sign in after signup (works when email confirmation is disabled)
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError("Account created! Now sign in.");
        setMode("signin");
        setLoading(false);
        return;
      }
      router.push("/");
      return;
    }

    // Sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("Incorrect username or password.");
      setLoading(false);
      return;
    }
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">

        <h1 className="text-3xl font-bold text-indigo-600 mb-1">Things To-do</h1>
        <p className="text-sm text-gray-400 mb-8">
          {mode === "signin" ? "Welcome back! Sign in to your list." : "Create an account to get started."}
        </p>

        {/* Tab toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => { setMode("signin"); setError(""); }}
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
              mode === "signin" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("signup"); setError(""); }}
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
              mode === "signup" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Username <span className="text-gray-300 font-normal">(no email needed)</span>
            </label>
            <input
              type="text"
              name="username"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(sanitize(e.target.value))}
              placeholder="e.g. rashmi"
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
            <input
              type="password"
              name="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {mode === "signup" && (
              <p className="text-xs text-gray-300 mt-1">At least 6 characters</p>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="text-xs text-gray-300 text-center mt-6">
          {mode === "signin" ? "No account? " : "Already have one? "}
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
            className="text-indigo-400 hover:text-indigo-600 transition-colors"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}
