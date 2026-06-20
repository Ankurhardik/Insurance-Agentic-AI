"use client";

import { useState, useEffect, useRef } from "react";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  time: string;
}

interface AccessRequest {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  username: string;
  email: string;
}

interface SpreadsheetSheet {
  name: string;
  rows: string[][];
}

const parseSpreadsheetData = (text: string, filename: string): SpreadsheetSheet[] => {
  const ext = filename.split(".").pop()?.toLowerCase();
  const sheets: SpreadsheetSheet[] = [];

  if (!text || text.trim() === "" || text.startsWith("[No data found") || text.startsWith("[Empty CSV") || text.startsWith("[Error extracting")) {
    return [];
  }

  if (ext === "csv" || !text.includes("--- Sheet: ")) {
    // Single sheet CSV or text without sheet labels
    const rows = text.split("\n").map(line => line.split(" | ").map(cell => cell.trim()));
    sheets.push({
      name: "CSV Sheet",
      rows: rows.filter(r => r.length > 0 && (r.length > 1 || r[0] !== ""))
    });
  } else {
    // Multi-sheet Excel
    const sections = text.split(/--- Sheet: (.*?) ---\n/);
    // sections will be: ["", "Sheet1", "row1|row2", "Sheet2", "row1|row2"]
    for (let i = 1; i < sections.length; i += 2) {
      const name = sections[i];
      const content = sections[i + 1] || "";
      const rows = content.split("\n").map(line => line.split(" | ").map(cell => cell.trim()));
      sheets.push({
        name: name,
        rows: rows.filter(r => r.length > 0 && (r.length > 1 || r[0] !== ""))
      });
    }
  }
  return sheets;
};

interface SlideshowSlide {
  index: number;
  content: string[];
}

const parseSlideshowData = (text: string): SlideshowSlide[] => {
  if (!text || text.trim() === "" || text.startsWith("[No text") || text.startsWith("[Error extracting")) {
    return [];
  }
  const slides: SlideshowSlide[] = [];
  const sections = text.split(/--- Slide (\d+) ---\n/);
  // sections will be: ["", "1", "content1", "2", "content2"]
  for (let i = 1; i < sections.length; i += 2) {
    const num = parseInt(sections[i], 10);
    const content = sections[i + 1] || "";
    slides.push({
      index: num,
      content: content.split("\n").map(l => l.trim()).filter(l => l !== "")
    });
  }
  return slides;
};

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

  // Dashboard Interaction State
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [dashboardTab, setDashboardTab] = useState("Home");
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const docxContainerRef = useRef<HTMLDivElement | null>(null);

  // Simulated Chat Logs per user role
  const [chatMessages, setChatMessages] = useState<Message[]>([]);

  // Database-backed Admin Request approvals list
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);

  // Database-backed User admin request status ("none" | "pending" | "approved" | "declined")
  const [adminRequestStatus, setAdminRequestStatus] = useState<string>("none");

  // Notifications dropdown state
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Knowledge Base State
  interface KnowledgeDocument {
    id: string;
    filename: string;
    content_type: string;
    file_size: number;
    status: string;
    created_at: string;
    created_by: string | null;
    extracted_text?: string | null;
  }
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDocument | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [sheetSearch, setSheetSearch] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  const filteredDocuments = documents.filter((doc) => 
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  // Initialize welcome messages when user changes
  useEffect(() => {
    if (user) {
      if (user.role === "admin") {
        setChatMessages([
          {
            id: "welcome-admin",
            sender: "agent",
            text: `Good morning, Director ${user.username}. Ready to manage system agents, employee clearances, and workspace knowledge bases. How can I assist you with admin operations today?`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setDashboardTab("Home");
      } else {
        setChatMessages([
          {
            id: "welcome-user",
            sender: "agent",
            text: `Good evening, ${user.username}. Ready to help compile your market reports, briefing notes, or sync strategy documents. What would you like to explore today?`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setDashboardTab("Home");
      }
    }
  }, [user]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isTyping]);

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
        
        // Fetch DB-backed access request metrics based on role
        if (userData.role === "admin") {
          fetchPendingRequests(sessionToken);
        } else {
          fetchRequestStatus(sessionToken);
        }
      } else {
        localStorage.removeItem("session_token");
      }
    } catch (err) {
      console.error("Failed to fetch session:", err);
    } finally {
      setCheckingSession(false);
    }
  };

  // Fetch pending requests for Admin from API
  const fetchPendingRequests = async (sessionToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/access-requests`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch pending requests:", err);
    }
  };

  // Fetch elevation request status for Standard User from API
  const fetchRequestStatus = async (sessionToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/access-request/status`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminRequestStatus(data.status);
      }
    } catch (err) {
      console.error("Failed to fetch request status:", err);
    }
  };

  const fetchDocuments = async (showLoadingSpinner = true) => {
    if (!token) return;
    if (showLoadingSpinner) setLoadingDocs(true);
    try {
      const res = await fetch("http://localhost:8000/api/documents", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      if (showLoadingSpinner) setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (token && dashboardTab === "Knowledge Base") {
      fetchDocuments();
    }
  }, [token, dashboardTab]);

  // Background polling while documents are in Pending or Processing state
  useEffect(() => {
    const hasPendingDocs = documents.some(
      (doc) => doc.status === "Pending" || doc.status === "Processing"
    );

    if (!hasPendingDocs || !token || dashboardTab !== "Knowledge Base") {
      return;
    }

    const interval = setInterval(() => {
      fetchDocuments(false); // poll in the background without showing spinner
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, token, dashboardTab]);

  const handleUploadClick = () => {
    document.getElementById("file-upload-input")?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    setUploading(true);
    try {
      const res = await fetch("http://localhost:8000/api/documents/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const newDocs = await res.json();
        fetchDocuments();
        alert(`Successfully uploaded ${newDocs.length} document(s).`);
      } else {
        const data = await res.json();
        alert(`Upload failed: ${data.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("An error occurred during file upload.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDocument = async (docId: string, filename: string) => {
    const confirmed = window.confirm(`Are you sure you want to permanently delete the document "${filename}"?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`http://localhost:8000/api/documents/${docId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        alert(`Successfully deleted "${filename}".`);
      } else {
        const data = await res.json();
        alert(`Delete failed: ${data.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("An error occurred during deletion.");
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewDoc(null);
    setActiveSheetIndex(0);
    setActiveSlideIndex(0);
    setSheetSearch("");
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  useEffect(() => {
    if (previewDoc && previewBlobUrl && docxContainerRef.current) {
      const fileExt = previewDoc.filename.split(".").pop()?.toLowerCase() || "";
      if (fileExt === "docx") {
        const renderDocx = async () => {
          try {
            if (docxContainerRef.current) {
              docxContainerRef.current.innerHTML = "<div class='p-4 text-center text-xs text-[#0f172a]/50 uppercase tracking-widest animate-pulse'>Rendering Word Document...</div>";
            }
            
            const blobRes = await fetch(previewBlobUrl);
            const blob = await blobRes.blob();
            
            const docx = await import("docx-preview");
            if (docxContainerRef.current) {
              docxContainerRef.current.innerHTML = "";
              await docx.renderAsync(blob, docxContainerRef.current, undefined, {
                inWrapper: false,
                ignoreWidth: false,
                ignoreHeight: false,
                experimental: true
              });
            }
          } catch (err) {
            console.error("Failed to render docx:", err);
            if (docxContainerRef.current) {
              docxContainerRef.current.innerHTML = `<div class="p-4 text-red-500 text-xs">[Failed to render document: ${err}]</div>`;
            }
          }
        };
        renderDocx();
      }
    }
  }, [previewDoc, previewBlobUrl]);

  const handlePreviewDocument = async (doc: KnowledgeDocument) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:8000/api/documents/${doc.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const detailedDoc = await res.json();
        setPreviewDoc(detailedDoc);
        
        // Reset sub-tab indexing and search states
        setActiveSheetIndex(0);
        setActiveSlideIndex(0);
        setSheetSearch("");
        
        // Fetch binary blob if it is a visual format (PDF, DOCX, or image)
        const ext = doc.filename.split(".").pop()?.toLowerCase();
        if (["pdf", "docx", "png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext || "")) {
          try {
            const serveRes = await fetch(`http://localhost:8000/api/documents/serve/${doc.id}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (serveRes.ok) {
              const blob = await serveRes.blob();
              const url = URL.createObjectURL(blob);
              setPreviewBlobUrl(url);
            } else {
              console.error("Failed to fetch document file blob");
            }
          } catch (blobErr) {
            console.error("Error fetching file blob:", blobErr);
          }
        }
        
        setPreviewOpen(true);
      } else {
        alert("Failed to retrieve document details.");
      }
    } catch (err) {
      console.error("Failed to fetch doc details:", err);
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
        
        if (data.user.role === "admin") {
          fetchPendingRequests(data.session_token);
        } else {
          fetchRequestStatus(data.session_token);
        }
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
    const confirmLogout = window.confirm("Are you sure you want to sign out?");
    if (!confirmLogout) return;
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
      setAdminRequestStatus("none");
      setPendingRequests([]);
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

  // Chat message submission
  const handleSendMessage = (textToSend?: string) => {
    const msgText = textToSend || chatInput;
    if (!msgText.trim()) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: msgText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setChatInput("");
    setIsTyping(true);

    // Simulate Agent response after 1.2 seconds
    setTimeout(() => {
      let responseText = "";
      if (user?.role === "admin") {
        if (msgText.toLowerCase().includes("agent")) {
          responseText = "Understood. The new system agent can be fine-tuned or registered using the '+ New Agent' portal in the sidebar. Let me know if you would like me to draft its baseline system prompt.";
        } else if (msgText.toLowerCase().includes("employee") || msgText.toLowerCase().includes("active")) {
          responseText = "Currently, there are active employees online. You can audit clearances and approve elevation requests in the Right Sidebar panel.";
        } else {
          responseText = `Yes, Director. I have updated the search indexes for your query regarding "${msgText}". The administrative cache is fully synchronized. What is your next instruction?`;
        }
      } else {
        if (msgText.toLowerCase().includes("report") || msgText.toLowerCase().includes("market")) {
          responseText = "I've analyzed the latest market telemetry. The quarterly report indicates a strong pivot toward automated policy underwriting. I can compile this into a summary PDF for you.";
        } else if (msgText.toLowerCase().includes("brief") || msgText.toLowerCase().includes("note")) {
          responseText = "Your daily briefing note is ready. It covers premium calculations, policy approvals in the pipeline, and agent performance matrices. Shall I display it here?";
        } else {
          responseText = `Hello ${user?.username}. I've processed your inquiry: "${msgText}". Let me know if you need to run a knowledge base search or synthesize this into a strategy sync document.`;
        }
      }

      const agentMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: "agent",
        text: responseText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages((prev) => [...prev, agentMsg]);
      setIsTyping(false);
    }, 1200);
  };

  const handleQuickAction = (actionText: string) => {
    handleSendMessage(actionText);
  };

  // DB-backed request approval
  const handleApproveRequest = async (id: string, name: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/access-requests/${id}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        alert(`Access request approved for ${name}. They are now an Admin.`);
        fetchPendingRequests(token);
      } else {
        const data = await res.json();
        alert(`Approval failed: ${data.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Approval request error:", err);
    }
  };

  // DB-backed request declination
  const handleDeclineRequest = async (id: string, name: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/access-requests/${id}/decline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        alert(`Access request declined for ${name}.`);
        fetchPendingRequests(token);
      } else {
        const data = await res.json();
        alert(`Decline failed: ${data.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Decline request error:", err);
    }
  };

  // DB-backed elevation request creation
  const handleRequestAdminAccess = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/access-request`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setAdminRequestStatus("pending");
        alert("Your request for admin access has been submitted to the database review queue.");
      } else {
        const data = await res.json();
        alert(`Request failed: ${data.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Access request submission error:", err);
    }
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
    <div className="flex min-h-screen flex-col justify-between bg-[#f7f9fb] font-sans text-[#0f172a]">
      {user ? (
        /* Authenticated Dashboard View (Three-pane Skeleton) */
        <div className="flex min-h-screen w-full overflow-hidden bg-white">
          
          {/* 1. Left Sidebar (Fixed 256px) */}
          <aside className="hidden md:flex w-64 flex-col border-r border-[#eef1f4] bg-[#f7f9fb] text-[#0f172a] shrink-0">
            {/* Header */}
            <div className="p-6 border-b border-[#eef1f4]">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-[4px] bg-[#0f172a] flex items-center justify-center text-white text-xs font-black">
                  EC
                </div>
                <div>
                  <h1 className="text-sm font-bold tracking-tight text-[#0f172a]">
                    {user.role === "admin" ? "ExecutiveChat" : "Enterprise Chat"}
                  </h1>
                  <p className="text-[10px] font-bold tracking-wider text-[#0f172a]/50 uppercase">
                    {user.role === "admin" ? "ENTERPRISE ADMIN" : "WORKSPACE"}
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Button (For Admin Only) */}
            {user.role === "admin" && (
              <div className="px-4 pt-5 pb-2">
                <button 
                  onClick={() => handleQuickAction("Initialize new custom agent deployment")}
                  className="w-full flex items-center justify-center gap-2 rounded-[4px] bg-[#0f172a] hover:bg-[#1e293b] py-2.5 text-xs font-bold text-white transition-all shadow-sm cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/>
                  </svg>
                  New Agent
                </button>
              </div>
            )}

            {/* Navigation Groups */}
            <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
              <div>
                <span className="px-3 text-[10px] font-bold text-[#0f172a]/40 uppercase tracking-widest block mb-2">
                  Navigation
                </span>
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => setDashboardTab("Home")}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-[4px] text-xs transition-all ${
                        dashboardTab === "Home"
                          ? "bg-[#eef1f4] text-[#0f172a] font-bold"
                          : "text-[#0f172a]/60 hover:text-[#0f172a] hover:bg-[#eef1f4]/50"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                      </svg>
                      Home
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setDashboardTab("Knowledge Base")}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-[4px] text-xs transition-all ${
                        dashboardTab === "Knowledge Base"
                          ? "bg-[#eef1f4] text-[#0f172a] font-bold"
                          : "text-[#0f172a]/60 hover:text-[#0f172a] hover:bg-[#eef1f4]/50"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                      </svg>
                      Knowledge Base
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setDashboardTab("Agents")}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-[4px] text-xs transition-all ${
                        dashboardTab === "Agents"
                          ? "bg-[#eef1f4] text-[#0f172a] font-bold"
                          : "text-[#0f172a]/60 hover:text-[#0f172a] hover:bg-[#eef1f4]/50"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
                      </svg>
                      Agents
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setDashboardTab("Chat History")}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-[4px] text-xs transition-all ${
                        dashboardTab === "Chat History"
                          ? "bg-[#eef1f4] text-[#0f172a] font-bold"
                          : "text-[#0f172a]/60 hover:text-[#0f172a] hover:bg-[#eef1f4]/50"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      Chat History
                    </button>
                  </li>
                  
                  {/* Admin-only Nav Item */}
                  {user.role === "admin" && (
                    <li>
                      <button
                        onClick={() => setDashboardTab("Active Employees")}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-[4px] text-xs transition-all ${
                          dashboardTab === "Active Employees"
                            ? "bg-[#eef1f4] text-[#0f172a] font-bold"
                            : "text-[#0f172a]/60 hover:text-[#0f172a] hover:bg-[#eef1f4]/50"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                        Active Employees
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            </nav>

            {/* Footer Navigation */}
            <div className="p-4 border-t border-[#eef1f4] space-y-1">
              <button
                onClick={() => setDashboardTab("Settings")}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-[4px] text-xs text-[#0f172a]/60 hover:text-[#0f172a] hover:bg-[#eef1f4]/50 transition-all text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                Settings
              </button>
              <button
                onClick={() => handleLogout()}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-[4px] text-xs text-rose-600 hover:bg-rose-50 transition-all text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                Sign Out
              </button>
            </div>
          </aside>

          {/* 2. Central Workspace (Fluid) */}
          <main className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Top Bar */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-[#eef1f4]">
              {/* Search Bar */}
              <div className="flex-1 max-w-md relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-[#0f172a]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={dashboardTab === "Knowledge Base" ? "Search documents by name..." : (user.role === "admin" ? "Search conversations or logs..." : "Search your workspace...")}
                  className="w-full rounded-[4px] bg-[#f7f9fb] border border-transparent pl-9 pr-4 py-1.5 text-xs text-[#0f172a] placeholder-[#0f172a]/40 focus:bg-white focus:border-[#0f172a]/20 outline-none transition-all"
                />
              </div>

              {/* Utility Actions */}
              <div className="flex items-center gap-4 ml-4">
                {/* Notification Bell */}
                <div className="relative">
                  <button 
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                    className="p-1.5 text-[#0f172a]/60 hover:text-[#0f172a] transition-colors relative cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    </svg>
                    {(user.role === "admin" ? pendingRequests.length > 0 : adminRequestStatus !== "none") && (
                      <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                    )}
                  </button>

                  {/* Sleek Notifications Dropdown Popover */}
                  {notificationsOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-[#eef1f4] rounded-[4px] shadow-lg py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 pb-2 border-b border-[#eef1f4] flex justify-between items-center">
                        <span className="text-[10px] font-bold text-[#0f172a]/50 uppercase tracking-widest">
                          Clearance Notifications
                        </span>
                        {user.role === "admin" && pendingRequests.length > 0 && (
                          <span className="bg-[#0f172a] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                            {pendingRequests.length}
                          </span>
                        )}
                      </div>
                      
                      <div className="max-h-64 overflow-y-auto px-2 py-1">
                        {user.role === "admin" ? (
                          pendingRequests.length > 0 ? (
                            pendingRequests.map((req) => (
                              <div key={req.id} className="p-2 hover:bg-[#f7f9fb] rounded-[4px] transition-colors flex flex-col gap-1.5 text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="h-5 w-5 rounded-full bg-[#0f172a]/5 text-[#0f172a] text-[9px] font-black flex items-center justify-center">
                                    {req.username ? req.username.slice(0,2).toUpperCase() : "??"}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[#0f172a] truncate">{req.username}</p>
                                    <p className="text-[9px] text-[#0f172a]/50 truncate">{req.email}</p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      handleApproveRequest(req.id, req.username);
                                      setNotificationsOpen(false);
                                    }}
                                    className="flex-1 bg-[#0f172a] text-white text-[9px] font-bold uppercase tracking-wider py-1 rounded-[4px] hover:bg-[#1e293b] cursor-pointer text-center"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleDeclineRequest(req.id, req.username);
                                      setNotificationsOpen(false);
                                    }}
                                    className="flex-1 border border-rose-200 text-rose-600 text-[9px] font-bold uppercase tracking-wider py-1 rounded-[4px] hover:bg-rose-50 cursor-pointer text-center"
                                  >
                                    Decline
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-6 text-[10px] text-[#0f172a]/40 font-semibold">
                              🎉 No pending clearance requests.
                            </div>
                          )
                        ) : (
                          adminRequestStatus !== "none" ? (
                            <div className="p-3 text-xs flex flex-col gap-1.5">
                              {adminRequestStatus === "pending" && (
                                <>
                                  <p className="font-bold text-amber-700">⏳ Request Pending</p>
                                  <p className="text-[10px] text-amber-600/70">Your clearance elevation request is currently under review by administrators.</p>
                                </>
                              )}
                              {adminRequestStatus === "approved" && (
                                <>
                                  <p className="font-bold text-emerald-700">✅ Request Approved!</p>
                                  <p className="text-[10px] text-emerald-600/70">Your elevation request was approved. Click activate below to refresh status.</p>
                                  <button
                                    onClick={() => {
                                      fetchSession(token || "");
                                      setNotificationsOpen(false);
                                    }}
                                    className="w-full mt-1 bg-[#0f172a] text-white text-[9px] font-bold uppercase tracking-wider py-1 rounded-[4px] hover:bg-[#1e293b] cursor-pointer text-center"
                                  >
                                    Activate Clearance
                                  </button>
                                </>
                              )}
                              {adminRequestStatus === "declined" && (
                                <>
                                  <p className="font-bold text-rose-700">❌ Request Declined</p>
                                  <p className="text-[10px] text-rose-600/70">Your admin elevation request was declined. You can request access again from the sidebar.</p>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-6 text-[10px] text-[#0f172a]/40 font-semibold">
                              🔔 No notifications.
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Toggle (Avatar + User Name) */}
                <button
                  onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                  className={`flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-[4px] border transition-all cursor-pointer ${
                    rightSidebarOpen ? "bg-[#eef1f4]/70 border-[#eef1f4]" : "border-transparent hover:bg-[#f7f9fb]"
                  }`}
                >
                  <div className="h-6 w-6 rounded-full bg-[#0f172a] text-white flex items-center justify-center text-[10px] font-bold">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-[#0f172a] hidden sm:inline">
                    {user.username}
                  </span>
                  <svg className="w-3 h-3 text-[#0f172a]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
              </div>
            </header>

            {/* Central Main Area */}
            <div className="flex-1 overflow-y-auto flex flex-col justify-between">
              {dashboardTab === "Knowledge Base" ? (
                /* Knowledge Base Workspace */
                <div className="p-6 md:p-8 space-y-6 flex-1">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#eef1f4] pb-5">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-[#0f172a]">Knowledge Base Workspace</h2>
                      <p className="text-xs text-[#0f172a]/50 mt-1">
                        Access, upload, and search verified guidelines and reference documentation.
                      </p>
                    </div>
                    {user.role === "admin" && (
                      <div>
                        <button
                          onClick={handleUploadClick}
                          disabled={uploading}
                          className="flex items-center justify-center gap-2 rounded-[4px] bg-[#0f172a] hover:bg-[#1e293b] px-4 py-2.5 text-xs font-bold text-white transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          {uploading ? (
                            <>
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                              </svg>
                              Upload Document
                            </>
                          )}
                        </button>
                        <input
                          id="file-upload-input"
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </div>
                    )}
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-[#f7f9fb] border border-[#eef1f4] rounded-[4px] flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] font-bold text-[#0f172a]/40 uppercase tracking-wider">Total Assets</span>
                        <h3 className="text-sm font-extrabold text-[#0f172a] mt-1">
                          {documents.length} {documents.length === 1 ? "Document" : "Documents"}
                        </h3>
                      </div>
                      <div className="h-9 w-9 rounded-full bg-[#0f172a]/5 flex items-center justify-center text-sm">
                        📚
                      </div>
                    </div>
                    
                    <div className="p-4 bg-[#f7f9fb] border border-[#eef1f4] rounded-[4px] flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] font-bold text-[#0f172a]/40 uppercase tracking-wider">Clearance Access</span>
                        <h3 className="text-sm font-extrabold text-[#0f172a] mt-1">
                          {user.role === "admin" ? "Level 5 (Admin)" : "Level 1 (Read-Only)"}
                        </h3>
                      </div>
                      <div className="h-9 w-9 rounded-full bg-[#0f172a]/5 flex items-center justify-center text-sm">
                        🛡️
                      </div>
                    </div>

                    <div className="p-4 bg-[#f7f9fb] border border-[#eef1f4] rounded-[4px] flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] font-bold text-[#0f172a]/40 uppercase tracking-wider">Indexing Engine</span>
                        <h3 className="text-sm font-extrabold text-emerald-600 mt-1 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Operational
                        </h3>
                      </div>
                      <div className="h-9 w-9 rounded-full bg-[#0f172a]/5 flex items-center justify-center text-sm">
                        ⚡
                      </div>
                    </div>
                  </div>

                  {/* Directory Table Card */}
                  <div className="bg-white border border-[#eef1f4] rounded-[4px] overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-[#eef1f4] flex justify-between items-center bg-[#f7f9fb]/50">
                      <span className="text-[10px] font-bold text-[#0f172a]/50 uppercase tracking-widest">
                        Document Directory
                      </span>
                      {searchQuery && (
                        <span className="text-[9px] bg-[#0f172a]/5 text-[#0f172a]/60 px-2 py-0.5 rounded-[4px] font-semibold">
                          Found {filteredDocuments.length} of {documents.length}
                        </span>
                      )}
                    </div>

                    {loadingDocs ? (
                      <div className="p-12 flex flex-col items-center justify-center gap-2">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0f172a] border-t-transparent"></div>
                        <span className="text-xs text-[#0f172a]/50">Retrieving index files...</span>
                      </div>
                    ) : filteredDocuments.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#eef1f4] bg-[#f7f9fb]/20 text-[9px] font-bold text-[#0f172a]/40 uppercase tracking-wider">
                              <th className="px-4 py-3">Name</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Upload Date</th>
                              <th className="px-4 py-3">File Size</th>
                              <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#eef1f4] text-xs">
                            {filteredDocuments.map((doc) => {
                              const ext = doc.filename.split('.').pop()?.toLowerCase();
                              let icon = "📄";
                              let iconColor = "text-slate-500";
                              if (ext === "pdf") { icon = "📕"; iconColor = "text-rose-500"; }
                              else if (["doc", "docx"].includes(ext || "")) { icon = "📘"; iconColor = "text-blue-500"; }
                              else if (["txt", "md"].includes(ext || "")) { icon = "📝"; iconColor = "text-emerald-500"; }
                              else if (ext === "json") { icon = "⚙️"; iconColor = "text-violet-500"; }

                              return (
                                <tr key={doc.id} className="hover:bg-[#f7f9fb]/40 transition-colors">
                                  <td className="px-4 py-3 font-semibold text-[#0f172a] max-w-[200px] sm:max-w-xs truncate">
                                    <span className={`inline-block mr-2 ${iconColor}`}>{icon}</span>
                                    {doc.filename}
                                  </td>
                                  <td className="px-4 py-3">
                                    {doc.status === "Ready" || doc.status === "Processed" ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-[4px]">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                        {doc.status}
                                      </span>
                                    ) : doc.status === "Failed" ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-[4px]">
                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                        {doc.status}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-[4px]">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                        {doc.status}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-[#0f172a]/60">
                                    {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </td>
                                  <td className="px-4 py-3 text-[#0f172a]/60 font-mono text-[10px]">
                                    {(doc.file_size / 1024).toFixed(1)} KB
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-1.5">
                                      <button
                                        onClick={() => handlePreviewDocument(doc)}
                                        title="Preview content"
                                        className="p-1 rounded-[4px] border border-slate-200 text-slate-500 hover:bg-[#eef1f4] hover:text-[#0f172a] transition-all cursor-pointer"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                        </svg>
                                      </button>
                                      {user.role === "admin" && (
                                        <button
                                          onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                                          title="Delete document"
                                          className="p-1 rounded-[4px] border border-rose-100 text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-16 text-center">
                        <span className="text-2xl block mb-2">📁</span>
                        <h4 className="text-xs font-bold text-[#0f172a]">No documents found</h4>
                        <p className="text-[10px] text-[#0f172a]/40 max-w-xs mx-auto mt-1 leading-relaxed">
                          {searchQuery ? "No records match your active search criteria." : "Upload guideline or reference files to populate the workspace directory."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Chat interface (existing) */
                <>
                  {/* Messages & Layout */}
                  <div className="p-6 md:p-8 space-y-8 flex-1">
                    {/* Dashboard Welcome Header */}
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-[#0f172a]">
                        {user.role === "admin" 
                          ? "Good morning, Director" 
                          : `Good evening, ${user.username}`}
                      </h2>
                      <p className="text-xs text-[#0f172a]/50 mt-1">
                        {user.role === "admin" 
                          ? "Active systems and operations dashboard. Review clearances and tune agent metrics below." 
                          : "Welcome to your digital operations center. Select a curated briefing or initiate queries below."}
                      </p>
                    </div>

                    {/* Quick Action Cards Grid */}
                    {chatMessages.length <= 1 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                        {user.role === "admin" ? (
                          /* Admin Quick Actions */
                          <>
                            <button
                              onClick={() => handleQuickAction("Generate comprehensive Knowledge Base sync log")}
                              className="flex flex-col text-left p-4 bg-[#f7f9fb] hover:bg-[#eef1f4] rounded-[4px] border border-[#eef1f4] transition-all cursor-pointer group"
                            >
                              <span className="text-xs font-bold text-[#0f172a] mb-1 flex items-center gap-1.5">
                                📚 Knowledge Base
                                <svg className="w-3 h-3 text-[#0f172a]/30 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                              </span>
                              <span className="text-[10px] text-[#0f172a]/50">Synchronize corporate insurance files & indexes.</span>
                            </button>
                            <button
                              onClick={() => handleQuickAction("Audit active Admin Operations")}
                              className="flex flex-col text-left p-4 bg-[#f7f9fb] hover:bg-[#eef1f4] rounded-[4px] border border-[#eef1f4] transition-all cursor-pointer group"
                            >
                              <span className="text-xs font-bold text-[#0f172a] mb-1 flex items-center gap-1.5">
                                🛡️ Admin Operations
                                <svg className="w-3 h-3 text-[#0f172a]/30 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                              </span>
                              <span className="text-[10px] text-[#0f172a]/50">Check access metrics and service uptime logs.</span>
                            </button>
                            <button
                              onClick={() => handleQuickAction("View employee roles and recent clearance level changes")}
                              className="flex flex-col text-left p-4 bg-[#f7f9fb] hover:bg-[#eef1f4] rounded-[4px] border border-[#eef1f4] transition-all cursor-pointer group"
                            >
                              <span className="text-xs font-bold text-[#0f172a] mb-1 flex items-center gap-1.5">
                                👥 Employee Management
                                <svg className="w-3 h-3 text-[#0f172a]/30 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                              </span>
                              <span className="text-[10px] text-[#0f172a]/50">Audit clearance requests and active personnel roles.</span>
                            </button>
                            <button
                              onClick={() => handleQuickAction("Display model performance and Agent Tuning logs")}
                              className="flex flex-col text-left p-4 bg-[#f7f9fb] hover:bg-[#eef1f4] rounded-[4px] border border-[#eef1f4] transition-all cursor-pointer group"
                            >
                              <span className="text-xs font-bold text-[#0f172a] mb-1 flex items-center gap-1.5">
                                ⚙️ Agent Tuning
                                <svg className="w-3 h-3 text-[#0f172a]/30 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                              </span>
                              <span className="text-[10px] text-[#0f172a]/50">Optimize LLM weights and evaluate system latency.</span>
                            </button>
                          </>
                        ) : (
                          /* User Quick Actions */
                          <>
                            <button
                              onClick={() => handleQuickAction("Fetch latest Market Report")}
                              className="flex flex-col text-left p-4 bg-[#f7f9fb] hover:bg-[#eef1f4] rounded-[4px] border border-[#eef1f4] transition-all cursor-pointer group"
                            >
                              <span className="text-xs font-bold text-[#0f172a] mb-1 flex items-center gap-1.5">
                                📈 Market Report
                                <svg className="w-3 h-3 text-[#0f172a]/30 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                              </span>
                              <span className="text-[10px] text-[#0f172a]/50">Analyze sector growth trends and underwriting stats.</span>
                            </button>
                            <button
                              onClick={() => handleQuickAction("Draft Briefing Note for policy updates")}
                              className="flex flex-col text-left p-4 bg-[#f7f9fb] hover:bg-[#eef1f4] rounded-[4px] border border-[#eef1f4] transition-all cursor-pointer group"
                            >
                              <span className="text-xs font-bold text-[#0f172a] mb-1 flex items-center gap-1.5">
                                📝 Briefing Note
                                <svg className="w-3 h-3 text-[#0f172a]/30 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                              </span>
                              <span className="text-[10px] text-[#0f172a]/50">Synthesize current policy updates and agent actions.</span>
                            </button>
                            <button
                              onClick={() => handleQuickAction("Generate Strategy Sync documentation")}
                              className="flex flex-col text-left p-4 bg-[#f7f9fb] hover:bg-[#eef1f4] rounded-[4px] border border-[#eef1f4] transition-all cursor-pointer group"
                            >
                              <span className="text-xs font-bold text-[#0f172a] mb-1 flex items-center gap-1.5">
                                🤝 Strategy Sync
                                <svg className="w-3 h-3 text-[#0f172a]/30 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                              </span>
                              <span className="text-[10px] text-[#0f172a]/50">Harmonize claim assessments with executive goals.</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Chat Message Thread */}
                    <div className="space-y-4 min-h-[250px] flex flex-col justify-end">
                      {chatMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[85%] ${
                            msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                          }`}
                        >
                          <div className="text-[10px] text-[#0f172a]/40 font-bold mb-1 uppercase tracking-wider">
                            {msg.sender === "user" ? "You" : "System Agent"} • {msg.time}
                          </div>
                          <div
                            className={`px-4 py-3 rounded-[4px] text-xs leading-relaxed border ${
                              msg.sender === "user"
                                ? "bg-[#0f172a] text-white border-transparent shadow-sm"
                                : "bg-[#f7f9fb] text-[#0f172a] border-[#eef1f4]"
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      ))}

                      {/* Thinking Loader */}
                      {isTyping && (
                        <div className="flex flex-col items-start max-w-[85%] mr-auto">
                          <div className="text-[10px] text-[#0f172a]/40 font-bold mb-1 uppercase tracking-wider">
                            System Agent is processing...
                          </div>
                          <div className="flex items-center gap-1 bg-[#f7f9fb] border border-[#eef1f4] rounded-[4px] px-4 py-3">
                            <span className="h-1.5 w-1.5 bg-[#0f172a]/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                            <span className="h-1.5 w-1.5 bg-[#0f172a]/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                            <span className="h-1.5 w-1.5 bg-[#0f172a]/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Chat Input (Sticky Footer) */}
                  <div className="p-6 border-t border-[#eef1f4] bg-white sticky bottom-0">
                    <div className="max-w-4xl mx-auto flex items-center gap-3">
                      {/* Attachment Icon */}
                      <button 
                        onClick={() => alert("File attachment upload simulated")}
                        className="p-2.5 text-[#0f172a]/50 hover:text-[#0f172a] hover:bg-[#f7f9fb] rounded-[4px] border border-[#eef1f4] transition-all cursor-pointer"
                        title="Attach File"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </button>

                      {/* Input Element */}
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder="Enter query or type instruction..."
                        className="flex-1 rounded-[4px] border border-[#eef1f4] bg-white px-4 py-2.5 text-xs text-[#0f172a] placeholder-[#0f172a]/30 focus:border-[#0f172a]/30 outline-none transition-all shadow-sm"
                      />

                      {/* Send Button */}
                      <button
                        onClick={() => handleSendMessage()}
                        disabled={!chatInput.trim()}
                        className="p-2.5 rounded-[4px] bg-[#0f172a] text-white hover:bg-[#1e293b] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </main>

          {/* 3. Right Sidebar (Collapsible 320px) */}
          {rightSidebarOpen && (
            <aside className="w-80 flex flex-col border-l border-[#eef1f4] bg-[#f7f9fb] shrink-0 overflow-y-auto animate-in slide-in-from-right duration-200">
              
              {/* Profile Overview Banner */}
              <div className="p-6 text-center border-b border-[#eef1f4] relative">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#0f172a]/5 text-[#0f172a] text-3xl font-extrabold border border-[#eef1f4]">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
                
                <h3 className="text-sm font-bold text-[#0f172a]">
                  {user.username}
                </h3>
                
                <p className="text-[10px] text-[#0f172a]/50 font-bold uppercase tracking-wider mt-0.5">
                  {user.role === "admin" ? "Operations Director" : "Standard Employee"}
                </p>

                {/* Status Badges */}
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                    user.role === "admin"
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-[#0f172a]/5 border-[#eef1f4] text-[#0f172a]/60"
                  }`}>
                    {user.role === "admin" ? "Super Admin" : "User Role"}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider">
                    {user.role === "admin" ? "Clearance L5" : "Clearance L1"}
                  </span>
                </div>
              </div>

              {/* Workspace Controls & Tabs */}
              <div className="flex-1 p-5 space-y-6">
                <div>
                  <div className="flex border-b border-[#eef1f4] pb-2 mb-4 justify-between items-center">
                    <span className="text-[10px] font-bold text-[#0f172a]/50 uppercase tracking-widest">
                      Profile Details
                    </span>
                    <span className="text-[9px] font-semibold text-emerald-600 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                    </span>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#0f172a]/40 font-semibold uppercase tracking-wider text-[9px]">Email</span>
                      <span className="font-semibold text-[#0f172a]">{user.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#0f172a]/40 font-semibold uppercase tracking-wider text-[9px]">Session DB ID</span>
                      <span className="font-mono text-[10px] text-[#0f172a]/70 truncate max-w-[140px]">{user.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#0f172a]/40 font-semibold uppercase tracking-wider text-[9px]">Registered At</span>
                      <span className="font-medium text-[#0f172a]/70">{new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Right Sidebar Interactive Flow Section */}
                {user.role === "admin" ? (
                  /* Admin Pending Approvals Queue */
                  <div className="pt-2">
                    <div className="flex border-b border-[#eef1f4] pb-2 mb-4 justify-between items-center">
                      <span className="text-[10px] font-bold text-[#0f172a]/50 uppercase tracking-widest">
                        Admin Requests Queue
                      </span>
                      {pendingRequests.length > 0 && (
                        <span className="h-4 px-1.5 flex items-center justify-center rounded-full bg-[#0f172a] text-white text-[8px] font-black">
                          {pendingRequests.length}
                        </span>
                      )}
                    </div>

                    {pendingRequests.length > 0 ? (
                      <div className="space-y-3">
                        {pendingRequests.map((req) => (
                          <div 
                            key={req.id} 
                            className="p-3 bg-white border border-[#eef1f4] rounded-[4px] shadow-sm text-xs flex flex-col gap-2 transition-all hover:shadow"
                          >
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-[#0f172a]/5 text-[#0f172a] text-[10px] font-bold flex items-center justify-center">
                                {req.username ? req.username.slice(0, 2).toUpperCase() : "??"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-[#0f172a] truncate">{req.username}</h4>
                                <p className="text-[9px] text-[#0f172a]/50 mt-0.5 truncate">{req.email}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1 border-t border-slate-50">
                              <button
                                onClick={() => handleApproveRequest(req.id, req.username)}
                                className="flex-1 rounded-[4px] bg-[#0f172a] text-white py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-[#1e293b] cursor-pointer text-center"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleDeclineRequest(req.id, req.username)}
                                className="flex-1 rounded-[4px] border border-rose-200 text-rose-600 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-rose-50 cursor-pointer text-center"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 border border-dashed border-[#eef1f4] rounded-[4px] bg-white">
                        <span className="text-[10px] text-[#0f172a]/40 font-bold block mb-1">🎉 Queue Clean</span>
                        <p className="text-[9px] text-[#0f172a]/40 px-3">All clearance requests have been processed.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Standard User Admin Elevation CTA */
                  <div className="pt-2">
                    <div className="flex border-b border-[#eef1f4] pb-2 mb-4 justify-between items-center">
                      <span className="text-[10px] font-bold text-[#0f172a]/50 uppercase tracking-widest">
                        Elevation Access
                      </span>
                    </div>

                    <div className="p-4 bg-white border border-[#eef1f4] rounded-[4px] shadow-sm text-center">
                      {(adminRequestStatus === "none" || adminRequestStatus === "declined") && (
                        <>
                          <span className="text-[11px] font-bold text-[#0f172a] block mb-1">Request Administrator Access</span>
                          <p className="text-[9.5px] text-[#0f172a]/50 mb-3.5 leading-normal">
                            Elevate your permissions to Clearance Level 5 and view active system employee lists.
                          </p>
                          {adminRequestStatus === "declined" && (
                            <p className="text-[9px] text-rose-500 font-bold mb-2">Previous request declined.</p>
                          )}
                          <button
                            onClick={handleRequestAdminAccess}
                            className="w-full rounded-[4px] bg-[#0f172a] text-white hover:bg-[#1e293b] py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                          >
                            Send Access Request
                          </button>
                        </>
                      )}
                      
                      {adminRequestStatus === "pending" && (
                        <div className="flex flex-col items-center gap-1.5 py-2">
                          <div className="h-6 w-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs">
                            ⏳
                          </div>
                          <span className="text-[11px] font-bold text-amber-700">Access Request Pending</span>
                          <p className="text-[9.5px] text-amber-600/70 leading-normal px-2">
                            Our team is auditing your clearance elevation. We will notify you once review is complete.
                          </p>
                        </div>
                      )}

                      {adminRequestStatus === "approved" && (
                        <div className="flex flex-col items-center gap-1.5 py-2">
                          <div className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
                            ✓
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700">Approved</span>
                          <p className="text-[9.5px] text-emerald-600/70 leading-normal px-2">
                            Please refresh or log back in to activate your administrator dashboard clearance.
                          </p>
                          <button
                            onClick={() => fetchSession(token || "")}
                            className="w-full mt-2 rounded-[4px] bg-[#0f172a] text-white hover:bg-[#1e293b] py-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                          >
                            Activate Clearance
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-[#eef1f4] flex justify-end">
                <button
                  onClick={() => setRightSidebarOpen(false)}
                  className="px-3 py-1.5 rounded-[4px] border border-[#eef1f4] hover:bg-[#eef1f4]/40 text-[10px] font-bold uppercase tracking-wider text-[#0f172a]/60 cursor-pointer"
                >
                  Close Pane
                </button>
              </div>
            </aside>
          )}

          {/* Document Preview Modal */}
          {previewOpen && previewDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="w-full max-w-4xl bg-white border border-[#eef1f4] rounded-[4px] shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-[#eef1f4] flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a] truncate max-w-lg">
                      {previewDoc.filename}
                    </h3>
                    <div className="flex gap-4 mt-1 text-[10px] font-semibold text-[#0f172a]/40 uppercase tracking-wider font-mono">
                      <span>Size: {(previewDoc.file_size / 1024).toFixed(1)} KB</span>
                      <span>Type: {previewDoc.content_type}</span>
                      <span>Uploaded: {new Date(previewDoc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleClosePreview}
                    className="p-1 rounded-[4px] hover:bg-[#eef1f4] text-[#0f172a]/50 hover:text-[#0f172a] transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#f7f9fb] text-xs">
                  {(() => {
                    const fileExt = previewDoc.filename.split(".").pop()?.toLowerCase() || "";

                    // Helper to get column letter (A, B, C...)
                    const getColLetter = (index: number): string => {
                      let letter = "";
                      let temp = index;
                      while (temp >= 0) {
                        letter = String.fromCharCode((temp % 26) + 65) + letter;
                        temp = Math.floor(temp / 26) - 1;
                      }
                      return letter;
                    };

                    // 1. PDF Preview
                    if (fileExt === "pdf") {
                      return (
                        <div className="w-full flex flex-col gap-2">
                          {previewBlobUrl ? (
                            <iframe
                              src={`${previewBlobUrl}#toolbar=0`}
                              className="w-full h-[60vh] border border-[#eef1f4] rounded-[4px] shadow-inner bg-white"
                              title={previewDoc.filename}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-[50vh] bg-white border border-[#eef1f4] rounded-[4px]">
                              <div className="flex flex-col items-center gap-2">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0f172a] border-t-transparent"></div>
                                <span className="text-[10px] font-bold text-[#0f172a]/60 uppercase tracking-widest animate-pulse">Loading PDF Document...</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // 2. Image Preview
                    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(fileExt)) {
                      return (
                        <div className="w-full flex flex-col items-center gap-4 bg-white border border-[#eef1f4] rounded-[4px] p-6 shadow-sm">
                          {previewBlobUrl ? (
                            <div className="relative group max-w-full overflow-hidden flex justify-center items-center rounded bg-[#f7f9fb] p-4 border border-[#eef1f4]/60">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={previewBlobUrl}
                                alt={previewDoc.filename}
                                className="max-h-[50vh] object-contain transition-transform duration-200"
                                id="preview-image-element"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-[50vh] w-full">
                              <div className="flex flex-col items-center gap-2">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0f172a] border-t-transparent"></div>
                                <span className="text-[10px] font-bold text-[#0f172a]/60 uppercase tracking-widest animate-pulse">Loading Image...</span>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                const img = document.getElementById("preview-image-element");
                                if (img) img.style.transform = `scale(1)`;
                              }}
                              className="px-3 py-1 bg-[#f7f9fb] hover:bg-[#eef1f4] border border-[#eef1f4] rounded-[4px] text-[10px] font-bold text-[#0f172a]/60 uppercase tracking-widest cursor-pointer transition-colors"
                            >
                              Reset Zoom
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // 3. Spreadsheet Preview (XLSX, XLS, CSV)
                    if (["xlsx", "xls", "csv"].includes(fileExt)) {
                      const sheets = parseSpreadsheetData(previewDoc.extracted_text || "", previewDoc.filename);
                      if (sheets.length === 0) {
                        return (
                          <div className="bg-white border border-[#eef1f4] rounded-[4px] p-6 text-center text-xs font-semibold text-[#0f172a]/50">
                            [No readable grid data extracted from this spreadsheet]
                          </div>
                        );
                      }
                      const activeSheet = sheets[activeSheetIndex] || sheets[0];
                      const maxCols = activeSheet.rows.reduce((max, r) => Math.max(max, r.length), 0);

                      return (
                        <div className="w-full flex flex-col gap-3">
                          {/* Spreadsheet Toolbar */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white border border-[#eef1f4] p-3 rounded-[4px] shadow-sm select-none">
                            {/* Tabs for sheets */}
                            <div className="flex flex-wrap gap-1">
                              {sheets.map((sheet, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setActiveSheetIndex(idx)}
                                  className={`px-3 py-1.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                                    activeSheetIndex === idx
                                      ? "bg-[#0f172a] text-white border-[#0f172a]"
                                      : "bg-white text-[#0f172a]/70 border-[#eef1f4] hover:bg-[#f7f9fb]"
                                  }`}
                                >
                                  📊 {sheet.name}
                                </button>
                              ))}
                            </div>
                            {/* Cell search */}
                            <div className="relative w-full sm:w-64">
                              <input
                                type="text"
                                placeholder="Find in sheet..."
                                value={sheetSearch}
                                onChange={(e) => setSheetSearch(e.target.value)}
                                className="w-full bg-[#f7f9fb] border border-[#eef1f4] rounded-[4px] px-3 py-1.5 text-[10px] font-semibold text-[#0f172a] placeholder-[#0f172a]/40 focus:bg-white outline-none focus:border-[#0f172a]/20"
                              />
                            </div>
                          </div>

                          {/* Grid container */}
                          <div className="bg-white border border-[#eef1f4] rounded-[4px] shadow-sm overflow-auto max-h-[55vh] select-text">
                            <table className="min-w-full border-collapse text-left font-mono text-[11px] leading-normal table-fixed">
                              <thead className="bg-[#f7f9fb] sticky top-0 z-10 border-b border-[#eef1f4]">
                                <tr>
                                  <th className="w-12 border-r border-[#eef1f4] p-1.5 text-center text-[#0f172a]/40 bg-[#f7f9fb]"></th>
                                  {Array.from({ length: maxCols }).map((_, i) => (
                                    <th key={i} className="min-w-[120px] border-r border-[#eef1f4] p-1.5 text-center font-bold text-[#0f172a]/60 bg-[#f7f9fb] uppercase">
                                      {getColLetter(i)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {activeSheet.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className="border-b border-[#eef1f4] hover:bg-[#f7f9fb]/40 transition-colors">
                                    <td className="sticky left-0 border-r border-[#eef1f4] p-1.5 text-center font-bold text-[#0f172a]/40 bg-[#f7f9fb] select-none">
                                      {rIdx + 1}
                                    </td>
                                    {Array.from({ length: maxCols }).map((_, cIdx) => {
                                      const cellValue = row[cIdx] !== undefined ? String(row[cIdx]) : "";
                                      const hasMatch = sheetSearch && cellValue.toLowerCase().includes(sheetSearch.toLowerCase());
                                      return (
                                        <td
                                          key={cIdx}
                                          className={`border-r border-[#eef1f4] p-1.5 truncate max-w-[200px] select-text ${
                                            hasMatch
                                              ? "bg-amber-100 text-amber-950 font-bold border-amber-300"
                                              : "text-[#0f172a]/80"
                                          }`}
                                          title={cellValue}
                                        >
                                          {cellValue}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    }

                    // 4. Slide Preview (PPTX, PPT)
                    if (["pptx", "ppt"].includes(fileExt)) {
                      const slides = parseSlideshowData(previewDoc.extracted_text || "");
                      if (slides.length === 0) {
                        return (
                          <div className="bg-white border border-[#eef1f4] rounded-[4px] p-6 text-center text-xs font-semibold text-[#0f172a]/50">
                            [No readable slide content extracted from this presentation]
                          </div>
                        );
                      }
                      const activeSlide = slides[activeSlideIndex] || slides[0];

                      return (
                        <div className="w-full flex flex-col gap-4">
                          {/* Slide Canvas */}
                          <div className="aspect-video w-full max-w-xl mx-auto rounded-[4px] border border-[#eef1f4] bg-[#0f172a] text-white shadow-lg p-8 flex flex-col justify-between relative select-text overflow-y-auto">
                            <div className="border-b border-white/10 pb-2 flex justify-between items-center select-none">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">Presentation Preview</span>
                              <span className="text-[9px] font-bold font-mono text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
                                Slide {activeSlide.index} of {slides.length}
                              </span>
                            </div>
                            
                            <div className="flex-1 flex flex-col justify-center my-4">
                              {activeSlide.content.length > 0 ? (
                                <div className="space-y-3">
                                  {/* First bullet can act as a title/header if it's large */}
                                  <h4 className="text-sm font-bold tracking-tight text-white mb-2">
                                    {activeSlide.content[0]}
                                  </h4>
                                  {activeSlide.content.slice(1).map((line, lIdx) => (
                                    <div key={lIdx} className="flex items-start gap-2 text-xs text-white/80 leading-relaxed pl-2">
                                      <span className="text-amber-400 select-none">•</span>
                                      <p>{line}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-center text-white/30 italic">Blank Slide</p>
                              )}
                            </div>

                            <div className="border-t border-white/5 pt-2 flex justify-between items-center text-[8px] font-bold text-white/30 select-none">
                              <span>{previewDoc.filename}</span>
                              <span>Insurance Agentic RAG Platform</span>
                            </div>
                          </div>

                          {/* Presentation Controls */}
                          <div className="flex items-center justify-center gap-4 bg-white border border-[#eef1f4] p-3 rounded-[4px] shadow-sm max-w-md mx-auto w-full select-none">
                            <button
                              onClick={() => setActiveSlideIndex(prev => Math.max(0, prev - 1))}
                              disabled={activeSlideIndex === 0}
                              className="px-3 py-1.5 rounded-[4px] border border-[#eef1f4] hover:bg-[#f7f9fb] disabled:opacity-40 disabled:hover:bg-white text-[10px] font-bold uppercase tracking-wider text-[#0f172a] cursor-pointer transition-colors"
                            >
                              ◀ Previous
                            </button>
                            <span className="text-[10px] font-bold font-mono text-[#0f172a]/60">
                              {activeSlideIndex + 1} / {slides.length}
                            </span>
                            <button
                              onClick={() => setActiveSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                              disabled={activeSlideIndex === slides.length - 1}
                              className="px-3 py-1.5 rounded-[4px] border border-[#eef1f4] hover:bg-[#f7f9fb] disabled:opacity-40 disabled:hover:bg-white text-[10px] font-bold uppercase tracking-wider text-[#0f172a] cursor-pointer transition-colors"
                            >
                              Next ▶
                            </button>
                          </div>

                          {/* Slide Thumbnails Selector */}
                          <div className="flex gap-2 justify-center overflow-x-auto py-1 max-w-lg mx-auto w-full select-none">
                            {slides.map((slide, idx) => (
                              <button
                                key={idx}
                                onClick={() => setActiveSlideIndex(idx)}
                                className={`w-8 h-6 rounded-[2px] border text-[8px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                                  activeSlideIndex === idx
                                    ? "bg-[#0f172a] text-white border-[#0f172a] scale-110 shadow-sm"
                                    : "bg-white text-[#0f172a]/50 border-[#eef1f4] hover:border-[#0f172a]/30"
                                }`}
                              >
                                {slide.index}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    // 5. Word Document Preview (DOCX, DOC)
                    if (fileExt === "docx") {
                      return (
                        <div className="w-full flex flex-col gap-2">
                          <div
                            ref={docxContainerRef}
                            className="w-full bg-white border border-[#eef1f4] rounded-[4px] shadow-sm max-h-[65vh] overflow-y-auto p-4 select-text"
                          />
                        </div>
                      );
                    }

                    if (fileExt === "doc") {
                      return (
                        <div className="max-w-2xl mx-auto bg-white border border-[#eef1f4] rounded-[4px] shadow-sm p-8 select-text font-serif leading-relaxed text-[#0f172a]/95 text-xs max-h-[60vh] overflow-y-auto">
                          <div className="prose prose-sm max-w-none">
                            {previewDoc.extracted_text ? (
                              previewDoc.extracted_text.split("\n").map((para, pIdx) => {
                                const trimmed = para.trim();
                                if (!trimmed) return <div key={pIdx} className="h-3" />;
                                
                                // Check if paragraph is table row data (separated by ' | ')
                                if (trimmed.includes(" | ")) {
                                  const cells = trimmed.split(" | ");
                                  return (
                                    <div key={pIdx} className="my-2 border border-slate-200 rounded-[2px] bg-slate-50 p-2 font-sans text-[11px] overflow-x-auto">
                                      <table className="w-full border-collapse">
                                        <tbody>
                                          <tr>
                                            {cells.map((cell, cIdx) => (
                                              <td key={cIdx} className="border-r border-slate-200 last:border-0 px-2 py-1 select-text">
                                                {cell}
                                              </td>
                                            ))}
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  );
                                }

                                // Otherwise render standard paragraph
                                return (
                                  <p key={pIdx} className="mb-3 text-[12px] leading-relaxed text-justify">
                                    {trimmed}
                                  </p>
                                );
                              })
                            ) : (
                              <p className="text-center italic text-slate-400 font-sans">[No content found in this document]</p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // 6. Source Code formats (JSON, YAML, YML, MD, TXT)
                    if (["json", "yaml", "yml", "md", "txt"].includes(fileExt)) {
                      return (
                        <div className="w-full flex flex-col gap-2">
                          {/* Copy to Clipboard and utility bar */}
                          <div className="flex justify-between items-center bg-white border border-[#eef1f4] px-4 py-2 rounded-[4px] shadow-sm select-none">
                            <span className="text-[9px] font-bold text-[#0f172a]/50 uppercase tracking-widest font-mono">
                              {fileExt} Format Source
                            </span>
                            <button
                              onClick={() => handleCopyToClipboard(previewDoc.extracted_text || "")}
                              className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-[4px] border border-[#eef1f4] bg-[#f7f9fb] hover:bg-[#eef1f4] transition-colors cursor-pointer text-[#0f172a]/80"
                            >
                              {copySuccess ? "✓ Copied!" : "📋 Copy Content"}
                            </button>
                          </div>

                          {/* Code Block Container */}
                          <pre className="bg-white border border-[#eef1f4] rounded-[4px] p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text text-[#0f172a]/80 shadow-sm max-h-[50vh] overflow-y-auto">
                            {previewDoc.extracted_text || "[No content extracted from this document]"}
                          </pre>
                        </div>
                      );
                    }

                    // Fallback visual container
                    return (
                      <div className="w-full flex flex-col gap-2">
                        <div className="bg-white border border-[#eef1f4] rounded-[4px] p-4 font-mono leading-relaxed whitespace-pre-wrap select-text text-[#0f172a]/80 shadow-sm max-h-[50vh] overflow-y-auto">
                          {previewDoc.extracted_text || "[No content extracted from this document]"}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-[#eef1f4] flex justify-end">
                  <button
                    onClick={handleClosePreview}
                    className="px-4 py-2 rounded-[4px] bg-[#0f172a] hover:bg-[#1e293b] text-xs font-bold text-white transition-all cursor-pointer shadow-sm"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        /* Unauthenticated Authentication View */
        <div className="flex min-h-screen flex-col justify-between px-4 md:px-8">
          
          {/* TopAppBar */}
          <header className="w-full py-6 flex items-center justify-between border-b border-[#d8dadc]/50 max-w-7xl mx-auto">
            <div className="text-lg font-extrabold tracking-tight text-[#0f172a]">
              ExecutiveChat
            </div>
            <nav className="flex items-center gap-6">
              <a href="#" className="text-sm font-medium text-[#0f172a]/70 hover:text-[#0f172a] transition-colors">Enterprise</a>
              <a href="#" className="text-sm font-medium text-[#0f172a]/70 hover:text-[#0f172a] transition-colors">API</a>
              <a href="#" className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 border border-[#d8dadc] rounded-[4px] text-[#0f172a] hover:bg-[#0f172a] hover:text-white transition-all">
                Support
              </a>
            </nav>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 flex items-center justify-center py-16">
            <div className="w-full max-w-[400px] bg-white border border-[#d8dadc] rounded-[4px] p-8 shadow-sm transition-all duration-300">
              <div className="mb-6 text-center">
                <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">
                  Professional Secure Portal
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
          </main>

          {/* Footer */}
          <footer className="w-full py-6 flex flex-col md:flex-row items-center justify-between border-t border-[#d8dadc]/50 text-[11px] text-[#0f172a]/40 max-w-7xl mx-auto gap-4">
            <div>
              &copy; 2026 ExecutiveChat Inc. All rights reserved.
            </div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-[#0f172a] transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-[#0f172a] transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-[#0f172a] transition-colors">Security</a>
              <a href="#" className="hover:text-[#0f172a] transition-colors">Status</a>
            </div>
          </footer>

        </div>
      )}
    </div>
  );
}
