import { useState, useEffect, useRef } from "react";
import { authApi } from "../api/auth";
import { toast } from "react-toastify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MdEdit, MdSave, MdLock } from "react-icons/md";
import { MdMail, MdSend, MdDelete, MdOutlineMarkEmailRead, MdAttachFile } from "react-icons/md";
import {
  validateProfileUpdate,
  validatePasswordChange,
} from "../utils/validation";
import { providerMailsApi, Provider } from "../api/providerMails";
import { isValidEmail } from "../utils/validation";

declare global {
  interface Window {
    electron?: { openExternal: (url: string) => void };
  }
}

export default function Profile() {
  const queryClient = useQueryClient();
  const [isEditing, isProfileEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [mailFolder, setMailFolder] = useState<"inbox" | "sent" | "drafts" | "trash">("inbox");
  const [mailProvider, setMailProvider] = useState<Provider>("google");
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({
    subject: "",
    bodyText: "",
    status: "sent" as "draft" | "sent",
    to: [] as string[],
  });
  const [composeFiles, setComposeFiles] = useState<File[]>([]);
  const [showMailModal, setShowMailModal] = useState(false);
  const [activeMail, setActiveMail] = useState<any | null>(null);
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const { data: usersList } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => authApi.getUsers(),
  });
  const [pageLimit] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [gmailTokens, setGmailTokens] = useState<string[]>([]);
  const currentGmailToken = gmailTokens.length ? gmailTokens[gmailTokens.length - 1] : null;
  const [msSkip, setMsSkip] = useState(0);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [msHasNext, setMsHasNext] = useState<boolean>(false);
  const pollTimer = useRef<number | null>(null);

  const { data: mailsResp, refetch: refetchMails, isFetching: mailsLoading } = useQuery({
    queryKey: ["provider-mails", mailProvider, mailFolder, pageIndex, currentGmailToken, msSkip, pageLimit],
    queryFn: () =>
      providerMailsApi.listMessages(
        mailProvider,
        mailFolder,
        mailProvider === "google"
          ? { limit: pageLimit, pageToken: currentGmailToken }
          : { limit: pageLimit, skip: msSkip }
      ),
  });
  const mails = mailsResp?.messages || [];
  useEffect(() => {
    const p = mailsResp?.paging;
    if (mailProvider === "google") {
      setNextPageToken((p && "nextPageToken" in p ? p.nextPageToken : null) || null);
      setMsHasNext(false);
    } else {
      setMsHasNext(!!(p && "nextLink" in p && p.nextLink));
      setNextPageToken(null);
    }
  }, [mailsResp, mailProvider]);
  useEffect(() => {
    setPageIndex(0);
    setGmailTokens([]);
    setMsSkip(0);
    setNextPageToken(null);
    setMsHasNext(false);
  }, [mailFolder, mailProvider]);
  const { data: linked, isLoading: linkedLoading } = useQuery({
    queryKey: ["linked-email-accounts"],
    queryFn: () => providerMailsApi.getLinkedAccounts(),
  });
  const composeMutation = useMutation({
    mutationFn: async () => {
      if (!composeData.subject) {
        throw new Error("Subject and recipients are required");
      }
      const emails =
        (usersList || [])
          .filter((u) => composeData.to.includes(u.id))
          .map((u) => u.email) || [];
      const finalTo = [...emails, ...toEmails];
      const finalCc = [...ccEmails];
      const finalBcc = [...bccEmails];
      const attachments =
        composeFiles.length > 0
          ? await Promise.all(
              composeFiles.map(
                (file) =>
                  new Promise<{ filename: string; contentType: string; contentBase64: string }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const result = reader.result as string;
                      const base64 = result.includes(",") ? result.split(",")[1] : result;
                      resolve({
                        filename: file.name,
                        contentType: file.type || "application/octet-stream",
                        contentBase64: base64,
                      });
                    };
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(file);
                  })
              )
            )
          : [];
      return providerMailsApi.sendMessage(mailProvider, {
        subject: composeData.subject,
        bodyText: composeData.bodyText,
        to: finalTo,
        cc: finalCc,
        bcc: finalBcc,
        attachments,
      });
    },
    onSuccess: () => {
      toast.success("Message sent");
      setShowCompose(false);
      setComposeData({ subject: "", bodyText: "", status: "sent", to: [] });
      setComposeFiles([]);
      setToEmails([]);
      setCcEmails([]);
      setBccEmails([]);
      refetchMails();
    },
    onError: (e: any) => {
      toast.error(e.message || "Failed to send");
    },
  });
  const deleteMailMutation = useMutation({
    mutationFn: (id: string) => providerMailsApi.deleteMessage(mailProvider, id),
    onSuccess: () => {
      toast.success("Message moved to trash");
      setShowMailModal(false);
      setActiveMail(null);
      refetchMails();
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
  });
  const markReadMutation = useMutation({
    mutationFn: (id: string) => providerMailsApi.markRead(mailProvider, id),
    onSuccess: () => {
      refetchMails();
    },
  });

  const sanitizeUrl = (url: string): string => {
    const cleaned = String(url || "").replace(/[`"']/g, "").trim();
    if (/^javascript:/i.test(cleaned)) return "#";
    return cleaned;
  };

  const normalizeHtml = (html: string): string => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      // ensure anchors are clickable and safe
      doc.querySelectorAll("a").forEach((a) => {
        const href = sanitizeUrl(a.getAttribute("href") || "");
        if (href) {
          a.setAttribute("href", href);
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
        } else {
          a.removeAttribute("href");
        }
      });
      return doc.body ? doc.body.innerHTML || "" : html;
    } catch {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) return bodyMatch[1];
      return html.replace(/<!DOCTYPE[^>]*>/i, "").replace(/<\/?html[^>]*>/gi, "").replace(/<\/?head[^>]*>[\s\S]*?<\/head>/gi, "").replace(/<\/?body[^>]*>/gi, "");
    }
  };

  const linkifyPlain = (text: string): string => {
    let out = String(text || "");
    const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;
    out = out.replace(urlRegex, (m) => {
      let href = m;
      if (/^www\./i.test(href)) href = "http://" + href;
      const safe = sanitizeUrl(href);
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${m}</a>`;
    });
    const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
    out = out.replace(emailRegex, (m) => {
      const safe = sanitizeUrl("mailto:" + m);
      return `<a href="${safe}">${m}</a>`;
    });
    out = out.replace(/\n/g, "<br/>");
    return out;
  };

  const getMessageContent = (m: any): { html: boolean; content: string } => {
    if (m && "body" in m && m.body) {
      const type = String(m.body.contentType || "Text").toLowerCase();
      const html = type === "html";
      const raw = String(m.body.content || "");
      const content = html ? normalizeHtml(raw) : raw;
      return { html, content };
    }
    if (m && "payload" in m && m.payload) {
      const decode = (data: string): string => {
        try {
          const norm = data.replace(/-/g, "+").replace(/_/g, "/");
          const bin = atob(norm);
          try {
            return decodeURIComponent(escape(bin));
          } catch {
            return bin;
          }
        } catch {
          return "";
        }
      };
      const findPart = (p: any): any => {
        if (!p) return null;
        const mt = String(p.mimeType || "").toLowerCase();
        if (mt === "text/html" || mt === "text/plain") return p;
        if (Array.isArray(p.parts)) {
          for (const part of p.parts) {
            const found = findPart(part);
            if (found) return found;
          }
        }
        return null;
      };
      const part = findPart(m.payload) || m.payload;
      const data = (part && part.body && part.body.data) || (m.payload.body && m.payload.body.data) || "";
      const html = String(part?.mimeType || "").toLowerCase() === "text/html";
      const raw = data ? decode(data) : String(m.snippet || "");
      const content = html ? normalizeHtml(raw) : raw;
      return { html, content };
    }
    return { html: false, content: String(m?.snippet || "") };
  };

  // Fetch user profile
  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => authApi.getProfile(),
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
      });
    }
  }, [profile]);

  useEffect(() => {
    const exec = async () => {
      if (!profile) return;
      if (linkedLoading || typeof linked === "undefined") return;
      const email = profile.email || "";
      const domain = email.split("@")[1]?.toLowerCase() || "";
      const domainIsGoogle = domain === "gmail.com";
      const domainIsMicrosoft =
        ["outlook.com", "hotmail.com", "live.com", "office.com", "msn.com", "microsoft.com"].includes(domain) ||
        (!domainIsGoogle && domain !== "");
      const preferred: Provider = domainIsGoogle ? "google" : domainIsMicrosoft ? "microsoft" : "google";
      if (linked && linked.providers && linked.providers.length > 0) {
        if (linked.providers.includes(preferred)) {
          setMailProvider(preferred);
        } else {
          setMailProvider(linked.providers[0]);
        }
        return;
      }
      if (!autoConnectAttempted && email) {
        setAutoConnectAttempted(true);
        try {
          const url = await providerMailsApi.getAuthUrl(preferred);
          if (window.electron && typeof window.electron.openExternal === "function") {
            window.electron.openExternal(url);
            if (!pollTimer.current) {
              let attempts = 0;
              const maxAttempts = 60;
              pollTimer.current = window.setInterval(async () => {
                attempts++;
                try {
                  const info = await providerMailsApi.getLinkedAccounts();
                  if (info.providers && info.providers.length > 0) {
                    if (info.providers.includes(preferred)) {
                      setMailProvider(preferred);
                    } else {
                      setMailProvider(info.providers[0]);
                    }
                    if (pollTimer.current) {
                      clearInterval(pollTimer.current);
                      pollTimer.current = null;
                    }
                  } else if (attempts >= maxAttempts) {
                    if (pollTimer.current) {
                      clearInterval(pollTimer.current);
                      pollTimer.current = null;
                    }
                  }
                } catch {
                  if (attempts >= maxAttempts && pollTimer.current) {
                    clearInterval(pollTimer.current);
                    pollTimer.current = null;
                  }
                }
              }, 2000);
            }
          } else {
            window.location.href = url;
          }
        } catch (e: any) {
          toast.error(e.message || "Failed to connect email");
        }
      }
    };
    exec();
  }, [profile, linked, linkedLoading, autoConnectAttempted]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, []);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: typeof formData) => authApi.updateProfile(data),
    onSuccess: (updatedUser) => {
      toast.success("Profile updated successfully");
      isProfileEditing(false);
      // Update the query cache with new data
      queryClient.setQueryData(["user-profile"], updatedUser);
      // Also refetch to ensure consistency
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile");
      console.error("Update profile error:", error);
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: typeof passwordData) => {
      if (data.newPassword !== data.confirmPassword) {
        throw new Error("Passwords do not match");
      }
      return authApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
      setShowPasswordModal(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to change password");
      console.error("Change password error:", error);
    },
  });

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveProfile = () => {
    // Validate form data before making API call
    const validation = validateProfileUpdate(formData);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    updateProfileMutation.mutate(formData);
  };

  const handleChangePassword = () => {
    // Validate password data before making API call
    const validation = validatePasswordChange(passwordData);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    changePasswordMutation.mutate(passwordData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block">
            <div className="w-12 h-12 border-4 border-gray-300 dark:border-[#3f51b5] border-t-primary-500 rounded-se-md rounded-es-md animate-spin"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Manage your account information and security settings</p>
      </div>

      {/* Two-column layout: Account Information + Email */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        <div className="h-full">
          <div className="card h-[60vh]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Account Information
              </h2>
              {!isEditing && (
                <button
                  onClick={() => isProfileEditing(true)}
                  className="btn btn-primary flex items-center space-x-2"
                >
                  <MdEdit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditing ? (
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleEditChange}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleEditChange}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleEditChange}
                    className="input"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      isProfileEditing(false);
                      if (profile) {
                        setFormData({
                          firstName: profile.firstName || "",
                          lastName: profile.lastName || "",
                          email: profile.email || "",
                        });
                      }
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending}
                    className="btn btn-primary flex items-center space-x-2"
                  >
                    <MdSave className="w-4 h-4" />
                    <span>{updateProfileMutation.isPending ? "Saving..." : "Save Changes"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-[#0f1929] p-4 rounded-se-md rounded-es-md">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      First Name
                    </p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {profile?.firstName || "N/A"}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#0f1929] p-4 rounded-se-md rounded-es-md">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Last Name
                    </p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {profile?.lastName || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-[#0f1929] p-4 rounded-se-md rounded-es-md">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Email Address
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {profile?.email}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-[#0f1929] p-4 rounded-se-md rounded-es-md">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Role
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                    {profile?.role.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-full">
          <div className="card h-[60vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Email</h2>
              <div className="flex items-center space-x-2">
                <button
                  className="btn btn-primary flex items-center space-x-2"
                  onClick={() => setShowCompose(true)}
                >
                  <MdMail className="w-4 h-4" />
                  <span>Compose</span>
                </button>
              </div>
            </div>
            <div className="flex space-x-2 mb-4">
              {["inbox", "sent", "drafts", "trash"].map((f) => (
                <button
                  key={f}
                  className={`px-4 py-2 rounded-se-md rounded-es-md ${
                    mailFolder === f ? "bg-primary-600 text-white" : "bg-gray-100 dark:bg-[#0f1929] text-gray-700 dark:text-gray-300"
                  }`}
                  onClick={() => setMailFolder(f as any)}
                >
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="bg-gray-50 dark:bg-[#0f1929] rounded-se-md rounded-es-md flex-1 flex flex-col min-h-0">
              {mailsLoading ? (
                <div className="p-6 text-gray-600 dark:text-gray-400">Loading...</div>
              ) : mails && mails.length > 0 ? (
                <>
                  <div className="flex-1 overflow-y-auto">
                    <ul>
                  {mails.map((m, i) => (
                    <li
                      key={("id" in m && m.id) || i}
                      className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-[#1b3a60]"
                    >
                      <button
                        className="flex-1 text-left"
                        onClick={async () => {
                          const msg = await providerMailsApi.getMessage(mailProvider, m.id);
                          setActiveMail(msg);
                          setShowMailModal(true);
                          if (mailFolder === "inbox") {
                            markReadMutation.mutate(m.id);
                          }
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <MdOutlineMarkEmailRead className="w-4 h-4 text-primary-600" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {`#${pageIndex * pageLimit + i + 1}`} {"subject" in m ? m.subject : ""}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {"bodyPreview" in m ? m.bodyPreview : ""}
                        </p>
                      </button>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {"receivedDateTime" in m ? new Date(m.receivedDateTime).toLocaleString() : ""}
                        </span>
                      </div>
                    </li>
                  ))}
                    </ul>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <button
                      className="btn"
                      disabled={pageIndex === 0}
                      onClick={() => {
                        if (mailProvider === "google") {
                          setGmailTokens((stk) => stk.slice(0, Math.max(stk.length - 1, 0)));
                        } else {
                          setMsSkip((s) => Math.max(s - pageLimit, 0));
                        }
                        setPageIndex((p) => Math.max(p - 1, 0));
                      }}
                    >
                      Prev
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Page {pageIndex + 1}
                    </span>
                    <button
                      className="btn"
                      disabled={
                        mailProvider === "google"
                          ? !(nextPageToken || mails.length === pageLimit)
                          : !(msHasNext || mails.length === pageLimit)
                      }
                      onClick={() => {
                        if (mailProvider === "google") {
                          if (nextPageToken) {
                            setGmailTokens((stk) => [...stk, nextPageToken!]);
                          }
                        } else {
                          setMsSkip((s) => s + pageLimit);
                        }
                        setPageIndex((p) => p + 1);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-6 text-gray-600 dark:text-gray-400">No messages</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="max-w-2xl">
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Security Settings
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#0f1929] rounded-se-md rounded-es-md">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Password
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Change your account password
                </p>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="btn btn-primary flex items-center space-x-2"
              >
                <MdLock className="w-4 h-4" />
                <span>Change Password</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-se-md rounded-es-md p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Change Password
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Password *
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="input"
                  placeholder="Enter your current password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Password *
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className="input"
                  placeholder="Enter your new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="input"
                  placeholder="Confirm your new password"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={changePasswordMutation.isPending}
                  className="btn btn-primary"
                >
                  {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#132f4c] rounded-se-md rounded-es-md w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
            <div className="border-b border-gray-200 dark:border-[#1b3a60] px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">New message</h3>
              <div className="flex items-center space-x-2">
                <button
                  className="btn btn-primary flex items-center space-x-2"
                  disabled={composeMutation.isPending}
                  onClick={() => composeMutation.mutate()}
                >
                  <MdSend className="w-4 h-4" />
                  <span>{composeMutation.isPending ? "Sending..." : "Send"}</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCompose(false);
                    setComposeData({ subject: "", bodyText: "", status: "sent", to: [] });
                    setComposeFiles([]);
                    setToEmails([]);
                    setCcEmails([]);
                    setBccEmails([]);
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
            <div className="px-4 py-3 space-y-3 flex-1 overflow-y-auto">
              <div className="flex items-start">
                <div className="w-16 text-sm text-gray-600 dark:text-gray-300 pt-2">To</div>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {toEmails.map((e, i) => (
                      <span key={`${e}-${i}`} className="px-2 py-1 rounded-se-md rounded-es-md bg-gray-100 dark:bg-[#0f1929] text-sm flex items-center">
                        {e}
                        <button
                          className="ml-2 text-gray-500 hover:text-gray-700"
                          onClick={() => setToEmails((arr) => arr.filter((x, idx) => !(x === e && idx === i)))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={toInput}
                    onChange={(e) => setToInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = toInput.trim();
                        if (isValidEmail(v)) {
                          setToEmails((arr) => Array.from(new Set([...arr, v])));
                          setToInput("");
                        }
                        e.preventDefault();
                      }
                    }}
                    placeholder="Type an email and press Enter"
                    className="input"
                  />
                  <select
                    multiple
                    value={composeData.to}
                    onChange={(e) => {
                      const options = Array.from(e.target.selectedOptions).map((o) => o.value);
                      setComposeData((p) => ({ ...p, to: options }));
                    }}
                    className="input mt-2"
                  >
                    {(usersList || []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24 text-right">
                  <button className="text-sm text-primary-600" onClick={() => setShowCc((s) => !s)}>
                    Cc
                  </button>
                  <button className="ml-2 text-sm text-primary-600" onClick={() => setShowBcc((s) => !s)}>
                    Bcc
                  </button>
                </div>
              </div>
              {showCc && (
                <div className="flex items-start">
                  <div className="w-16 text-sm text-gray-600 dark:text-gray-300 pt-2">Cc</div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {ccEmails.map((e, i) => (
                        <span key={`${e}-${i}`} className="px-2 py-1 rounded-se-md rounded-es-md bg-gray-100 dark:bg-[#0f1929] text-sm flex items-center">
                          {e}
                          <button
                            className="ml-2 text-gray-500 hover:text-gray-700"
                            onClick={() => setCcEmails((arr) => arr.filter((x, idx) => !(x === e && idx === i)))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={ccInput}
                      onChange={(e) => setCcInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = ccInput.trim();
                          if (isValidEmail(v)) {
                            setCcEmails((arr) => Array.from(new Set([...arr, v])));
                            setCcInput("");
                          }
                          e.preventDefault();
                        }
                      }}
                      placeholder="Type an email and press Enter"
                      className="input"
                    />
                  </div>
                </div>
              )}
              {showBcc && (
                <div className="flex items-start">
                  <div className="w-16 text-sm text-gray-600 dark:text-gray-300 pt-2">Bcc</div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {bccEmails.map((e, i) => (
                        <span key={`${e}-${i}`} className="px-2 py-1 rounded-se-md rounded-es-md bg-gray-100 dark:bg-[#0f1929] text-sm flex items-center">
                          {e}
                          <button
                            className="ml-2 text-gray-500 hover:text-gray-700"
                            onClick={() => setBccEmails((arr) => arr.filter((x, idx) => !(x === e && idx === i)))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={bccInput}
                      onChange={(e) => setBccInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = bccInput.trim();
                          if (isValidEmail(v)) {
                            setBccEmails((arr) => Array.from(new Set([...arr, v])));
                            setBccInput("");
                          }
                          e.preventDefault();
                        }
                      }}
                      placeholder="Type an email and press Enter"
                      className="input"
                    />
                  </div>
                </div>
              )}
              <div className="flex items-start">
                <div className="w-16 text-sm text-gray-600 dark:text-gray-300 pt-2">Subject</div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={composeData.subject}
                    onChange={(e) => setComposeData((p) => ({ ...p, subject: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <textarea
                  rows={10}
                  value={composeData.bodyText}
                  onChange={(e) => setComposeData((p) => ({ ...p, bodyText: e.target.value }))}
                  className="input"
                  placeholder="Type your message"
                />
              </div>
            </div>
            <div className="border-t border-gray-200 dark:border-[#1b3a60] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <label className="btn btn-secondary flex items-center space-x-2">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []).slice(0, 10);
                      setComposeFiles(files);
                    }}
                  />
                  <MdAttachFile className="w-4 h-4" />
                  <span>Attach</span>
                </label>
                {composeFiles.length > 0 && (
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {composeFiles.length} attachment(s)
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  className="btn btn-primary flex items-center space-x-2"
                  disabled={composeMutation.isPending}
                  onClick={() => composeMutation.mutate()}
                >
                  <MdSend className="w-4 h-4" />
                  <span>{composeMutation.isPending ? "Sending..." : "Send"}</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCompose(false);
                    setComposeData({ subject: "", bodyText: "", status: "sent", to: [] });
                    setComposeFiles([]);
                    setToEmails([]);
                    setCcEmails([]);
                    setBccEmails([]);
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMailModal && activeMail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-[#132f4c] rounded-se-md rounded-es-md p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {activeMail.subject || `Message ${activeMail.id}`}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowMailModal(false)}
                >
                  Close
                </button>
                <button
                  className="btn btn-danger flex items-center space-x-2"
                  onClick={() => deleteMailMutation.mutate(activeMail.id)}
                >
                  <MdDelete className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">From:</span>{" "}
                {(() => {
                  if ("from" in activeMail) {
                    return activeMail.from?.emailAddress?.address || activeMail.from || "";
                  }
                  if ("payload" in activeMail && activeMail.payload?.headers) {
                    const h = (activeMail.payload.headers || []).find((x: any) => x.name?.toLowerCase() === "from");
                    return h?.value || "";
                  }
                  return "";
                })()}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">To:</span>{" "}
                {(() => {
                  if ("toRecipients" in activeMail) {
                    return (activeMail.toRecipients || [])
                      .map((r: any) => r.emailAddress?.address)
                      .join(", ");
                  }
                  if ("payload" in activeMail && activeMail.payload?.headers) {
                    const h = (activeMail.payload.headers || []).find((x: any) => x.name?.toLowerCase() === "to");
                    return h?.value || "";
                  }
                  if ("to" in activeMail) {
                    return Array.isArray(activeMail.to) ? activeMail.to.join(", ") : activeMail.to || "";
                  }
                  return "";
                })()}
              </div>
              <div className="prose dark:prose-invert max-h-[60vh] overflow-y-auto">
                {(() => {
                  const c = getMessageContent(activeMail);
                  if (c.html) {
                    return <div className="text-gray-900 dark:text-white" dangerouslySetInnerHTML={{ __html: c.content }} />;
                  }
                  return <div className="text-gray-900 dark:text-white" dangerouslySetInnerHTML={{ __html: linkifyPlain(c.content) }} />;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
