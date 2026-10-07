"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Send } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { Swap, soft } from "@/components/motion";
import { createBrowserAuthClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await createBrowserAuthClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: false },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  }

  return (
    <main data-section="write" className="flex flex-1 items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={soft}
        className="w-full max-w-[400px]"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ rotate: -8, scale: 0.9 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ ...soft, delay: 0.1 }}
          >
            <LogoMark size={56} />
          </motion.div>
          <h1 className="mt-5 text-[34px] leading-none font-semibold">
            Your <span className="hl">drafts</span>, your voice
          </h1>
          <p className="mt-3 text-[15px] text-ink-soft">Sign in with a one-time link. No password.</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          {state === "sent" ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={soft}
              className="flex items-start gap-3"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint-soft text-mint-ink">
                <Check size={18} />
              </span>
              <div>
                <p className="font-medium">Link sent</p>
                <p className="mt-1 text-[14px] text-ink-soft">
                  Check <span className="text-ink">{email}</span>. The link opens Draftsmith in this browser.
                </p>
              </div>
            </motion.div>
          ) : (
            <>
              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button className="btn-primary w-full" disabled={state === "sending"}>
                {state === "sending" ? <span className="spinner" /> : <Send size={16} />}
                <Swap id={state === "sending" ? "sending" : "idle"}>
                  {state === "sending" ? "Sending" : "Email me a link"}
                </Swap>
              </button>
              {state === "error" && (
                <p role="alert" className="text-[14px] text-danger">
                  {message}
                </p>
              )}
            </>
          )}
        </form>
      </motion.div>
    </main>
  );
}
