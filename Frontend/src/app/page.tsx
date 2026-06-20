"use client";

import { useState, useEffect } from "react";

interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Loading & feedback states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const API_BASE = "http://localhost:8000/api/auth";
  const GOOGLE_CLIENT_ID = "327586945551-flc885mv8l2fohbc75qksliq0d0k1q4c.apps.googleusercontent.com";

  // Check session on mount and extract query errors
  useEffect(() => {
    const savedToken = localStorage.getItem("session_token");
    if (savedToken) {
      fetchSession(savedToken);
    } else {
      setCheckingSession(false);
    }

    // Extract potential OAuth error from query params
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (err) {
        setError(decodeURIComponent(err));
        // Clean URL query parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const fetchSession = async (sessionToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setToken(sessionToken);
      } else {
        localStorage.removeItem("session_token");
      }
    } catch (err) {
      console.error("Failed to fetch session:", err);
    } finally {
      setCheckingSession(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const isLogin = activeTab === "login";
    const endpoint = isLogin ? "/login" : "/register";
    const payload = isLogin 
      ? { username, password }
      : { username, email, password };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      if (isLogin) {
        localStorage.setItem("session_token", data.session_token);
        setToken(data.session_token);
        setUser(data.user);
        setSuccess("Login successful! Welcome back.");
        setUsername("");
        setPassword("");
      } else {
        setSuccess("Account created successfully! You can now log in.");
        setActiveTab("login");
        setEmail("");
        setPassword("");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!token) return;
    try {
      await fetch(`${API_BASE}/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error("Logout request error:", err);
    } finally {
      localStorage.removeItem("session_token");
      setUser(null);
      setToken(null);
      setSuccess("Logged out successfully.");
    }
  };

  const handleGoogleLogin = () => {
    const redirectUri = "http://localhost:3000/auth/callback";
    const scope = "openid email profile";
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    window.location.href = googleAuthUrl;
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fb] text-[#0f172a] font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#0f172a] border-t-transparent"></div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0f172a]/60 animate-pulse">Checking Session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#f7f9fb] font-sans text-[#0f172a] px-4 md:px-8">
      {/* TopAppBar */}
      <header className="w-full py-6 flex items-center justify-between border-b border-[#d8dadc]/50 max-w-7xl mx-auto">
        <div className="text-lg font-extrabold tracking-tight text-[#0f172a]">
          AuthSystem
        </div>
        <nav className="flex items-center gap-6">
          <a href="#" className="text-sm font-medium text-[#0f172a]/70 hover:text-[#0f172a] transition-colors">Product</a>
          <a href="#" className="text-sm font-medium text-[#0f172a]/70 hover:text-[#0f172a] transition-colors">Company</a>
          <a href="#" className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 border border-[#d8dadc] rounded-[4px] text-[#0f172a] hover:bg-[#0f172a] hover:text-white transition-all">
            Support
          </a>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center py-16">
        {user ? (
          /* Authenticated Dashboard View */
          <div className="w-full max-w-[440px] bg-white border border-[#d8dadc] rounded-[4px] p-8 shadow-sm transition-all duration-300">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f172a]/5 text-2xl text-[#0f172a]">
                👤
              </div>
              <h2 className="text-xl font-bold tracking-tight">Welcome Back</h2>
              <p className="text-xs font-semibold text-[#0f172a]/60 mt-1">@{user.username}</p>
            </div>

            <div className="space-y-4 rounded-[4px] bg-[#f7f9fb] p-5 text-sm border border-[#d8dadc]/50">
              <div className="flex justify-between border-b border-[#d8dadc]/40 pb-2">
                <span className="text-[#0f172a]/50 text-xs font-semibold uppercase tracking-wider">Email</span>
                <span className="font-medium text-[#0f172a]">{user.email}</span>
              </div>
              <div className="flex justify-between border-b border-[#d8dadc]/40 pb-2">
                <span className="text-[#0f172a]/50 text-xs font-semibold uppercase tracking-wider">User ID</span>
                <span className="font-mono text-xs text-[#0f172a] truncate max-w-[180px]" title={user.id}>{user.id}</span>
              </div>
              <div className="flex justify-between border-b border-[#d8dadc]/40 pb-2">
                <span className="text-[#0f172a]/50 text-xs font-semibold uppercase tracking-wider">Joined</span>
                <span className="font-medium">{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[#0f172a]/50 text-xs font-semibold uppercase tracking-wider">Session Token</span>
                <span className="font-mono text-[10px] break-all text-[#0f172a]/80 bg-white rounded-[4px] p-2.5 border border-[#d8dadc] select-all">
                  {token}
                </span>
              </div>
            </div>

            {success && (
              <div className="mt-4 rounded-[4px] bg-emerald-50 border border-emerald-200 p-3 text-center text-xs font-medium text-emerald-700">
                {success}
              </div>
            )}

            <button
              onClick={handleLogout}
              className="mt-6 w-full rounded-[4px] bg-[#0f172a] hover:bg-[#1e293b] py-3 text-xs font-bold uppercase tracking-wider text-white transition-all duration-150 cursor-pointer shadow-sm"
            >
              Sign Out
            </button>
          </div>
        ) : (
          /* Auth Form Card */
          <div className="w-full max-w-[400px] bg-white border border-[#d8dadc] rounded-[4px] p-8 shadow-sm transition-all duration-300">
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">
                Professional Login & Sign Up
              </h1>
              <p className="mt-1.5 text-xs text-[#0f172a]/50">Enter credentials or connect with social provider</p>
            </div>

            {/* Tabs */}
            <div className="relative mb-6 flex border-b border-[#d8dadc]">
              <button
                onClick={() => {
                  setActiveTab("login");
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex-1 pb-3 text-center text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-b-2 -mb-[2px] ${
                  activeTab === "login" 
                    ? "border-[#0f172a] text-[#0f172a]" 
                    : "border-transparent text-[#0f172a]/40 hover:text-[#0f172a]/70"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setActiveTab("signup");
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex-1 pb-3 text-center text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-b-2 -mb-[2px] ${
                  activeTab === "signup" 
                    ? "border-[#0f172a] text-[#0f172a]" 
                    : "border-transparent text-[#0f172a]/40 hover:text-[#0f172a]/70"
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Feedback Alerts */}
            {error && (
              <div className="mb-4 rounded-[4px] bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-700 flex items-center gap-2">
                <span>⚠️</span> <span className="flex-1">{error}</span>
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-[4px] bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-700 flex items-center gap-2">
                <span>✅</span> <span className="flex-1">{success}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0f172a] mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="enter username"
                  className="w-full rounded-[4px] border border-[#d8dadc] bg-white px-3.5 py-2.5 text-sm text-[#0f172a] placeholder-[#0f172a]/30 outline-none transition-all focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]"
                />
              </div>

              {activeTab === "signup" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0f172a] mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-[4px] border border-[#d8dadc] bg-white px-3.5 py-2.5 text-sm text-[#0f172a] placeholder-[#0f172a]/30 outline-none transition-all focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0f172a] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-[4px] border border-[#d8dadc] bg-white px-3.5 py-2.5 text-sm text-[#0f172a] placeholder-[#0f172a]/30 outline-none transition-all focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center rounded-[4px] bg-[#0f172a] hover:bg-[#1e293b] py-3 text-xs font-bold uppercase tracking-wider text-white transition-all duration-150 shadow-sm disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : activeTab === "login" ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#d8dadc]/60"></div>
              </div>
              <span className="relative bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-[#0f172a]/40">
                Or Continue With
              </span>
            </div>

            {/* Social Auth */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-2.5 rounded-[4px] border border-[#d8dadc] bg-white py-3 text-xs font-bold uppercase tracking-wider text-[#0f172a] hover:bg-[#f7f9fb] transition-all duration-150 cursor-pointer shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-6 flex flex-col md:flex-row items-center justify-between border-t border-[#d8dadc]/50 text-[11px] text-[#0f172a]/40 max-w-7xl mx-auto gap-4">
        <div>
          &copy; 2024 AuthSystem Inc. All rights reserved.
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-[#0f172a] transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-[#0f172a] transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-[#0f172a] transition-colors">Security</a>
          <a href="#" className="hover:text-[#0f172a] transition-colors">Status</a>
        </div>
      </footer>
    </div>
  );
}
