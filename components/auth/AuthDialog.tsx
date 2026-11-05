"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type AuthDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  supabase: SupabaseClient;
  user: User | null;
};

type AuthMode = "sign-in" | "sign-up";

export default function AuthDialog({ isOpen, onClose, supabase, user }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMessage("");
      setPassword("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setMessage(error ? error.message : "ログインしました");
      setIsSubmitting(false);
      if (!error) onClose();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() || "ユーザー" },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      setMessage(error.message);
    } else if (data.session) {
      setMessage("登録しました");
      onClose();
    } else {
      setMessage("確認メールを送信しました");
    }

    setIsSubmitting(false);
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    const { error } = await supabase.auth.signOut();
    setIsSubmitting(false);
    setMessage(error ? error.message : "");
    if (!error) onClose();
  }

  return (
    <div className="auth-backdrop" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section aria-label={user ? "アカウント" : "ログイン"} aria-modal="true" className="auth-dialog" role="dialog">
        <div className="auth-dialog-heading">
          <h2>{user ? "アカウント" : mode === "sign-in" ? "ログイン" : "アカウント登録"}</h2>
          <button aria-label="閉じる" className="auth-close" onClick={onClose} type="button">×</button>
        </div>

        {user ? (
          <div className="auth-account">
            <span className="field-label">ログイン中</span>
            <strong>{user.email}</strong>
            <button className="auth-submit" disabled={isSubmitting} onClick={handleSignOut} type="button">
              ログアウト
            </button>
          </div>
        ) : (
          <>
            <div className="auth-mode-switch">
              <button className={mode === "sign-in" ? "is-active" : ""} onClick={() => setMode("sign-in")} type="button">ログイン</button>
              <button className={mode === "sign-up" ? "is-active" : ""} onClick={() => setMode("sign-up")} type="button">新規登録</button>
            </div>
            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === "sign-up" ? (
                <label>
                  <span>表示名</span>
                  <input autoComplete="nickname" maxLength={50} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
                </label>
              ) : null}
              <label>
                <span>メールアドレス</span>
                <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              </label>
              <label>
                <span>パスワード</span>
                <input autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
              </label>
              <button className="auth-submit" disabled={isSubmitting} type="submit">
                {mode === "sign-in" ? "ログイン" : "登録"}
              </button>
            </form>
          </>
        )}

        {message ? <p className="auth-message" role="status">{message}</p> : null}
      </section>
    </div>
  );
}
