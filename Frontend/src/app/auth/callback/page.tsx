"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  useEffect(() => {
    if (error) {
      console.error("Google login error:", error);
      router.push("/?error=" + encodeURIComponent(error));
      return;
    }

    if (code) {
      const exchangeCode = async () => {
        try {
          const res = await fetch("http://localhost:8000/api/auth/google", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              code,
              redirect_uri: "http://localhost:3000/auth/callback",
            }),
          });

          const data = await res.json();
          if (res.ok) {
            localStorage.setItem("session_token", data.session_token);
            router.push("/");
          } else {
            console.error("Google authentication failed in backend:", data.detail);
            router.push("/?error=" + encodeURIComponent(data.detail || "Authentication failed"));
          }
        } catch (err: any) {
          console.error("Failed to authenticate with backend:", err);
          router.push("/?error=" + encodeURIComponent("Failed to connect to authentication server"));
        }
      };
      exchangeCode();
    } else {
      router.push("/");
    }
  }, [code, error, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0f172a] border-t-transparent"></div>
      <p className="text-sm font-medium text-[#0f172a]/70 animate-pulse">
        Completing Google authentication...
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0f172a] border-t-transparent"></div>
        <p className="text-sm font-medium text-[#0f172a]/70">Loading...</p>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
