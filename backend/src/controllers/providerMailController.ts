import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { getTable } from "../utils/dbHelper";
import { eq } from "drizzle-orm";

type EmailAccountRow = typeof schema.emailAccounts.$inferSelect;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_GMAIL_LIST = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const GOOGLE_GMAIL_GET = (id: string) => `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`;
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MS_GRAPH_LIST = "https://graph.microsoft.com/v1.0/me/messages";
const MS_GRAPH_GET = (id: string) => `https://graph.microsoft.com/v1.0/me/messages/${id}`;

function getEnv(name: string, optional = false) {
  const v = process.env[name];
  if (!v && !optional) {
    throw new Error(`Missing env: ${name}`);
  }
  return v!;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

async function fetchJson<T>(url: string, options: any): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const getAuthUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { provider } = req.params;
    const state = encodeURIComponent(JSON.stringify({ provider }));

    if (provider === "google") {
      const url = new URL(GOOGLE_AUTH_URL);
      url.searchParams.set("client_id", getEnv("GOOGLE_CLIENT_ID"));
      url.searchParams.set("redirect_uri", getEnv("GOOGLE_REDIRECT_URL"));
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", GOOGLE_SCOPES);
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("state", state);
      return res.json({ url: url.toString() });
    }
    if (provider === "microsoft") {
      const url = new URL(MS_AUTH_URL);
      url.searchParams.set("client_id", getEnv("MS_CLIENT_ID"));
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", getEnv("MS_REDIRECT_URL"));
      url.searchParams.set("response_mode", "query");
      url.searchParams.set("scope", "offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send");
      url.searchParams.set("state", state);
      return res.json({ url: url.toString() });
    }
    return res.status(400).json({ error: "Unsupported provider" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const oauthCallback = async (req: AuthRequest, res: Response) => {
  try {
    const { provider } = req.params;
    const { code } = req.query as any;
    const userId = req.user!.id;
    const company = req.user?.company;

    if (!code) {
      return res.status(400).json({ error: "Missing code" });
    }

    if (provider === "google") {
      const body = new URLSearchParams({
        code: code as string,
        client_id: getEnv("GOOGLE_CLIENT_ID"),
        client_secret: getEnv("GOOGLE_CLIENT_SECRET"),
        redirect_uri: getEnv("GOOGLE_REDIRECT_URL"),
        grant_type: "authorization_code",
      });
      const token = await fetchJson<OAuthTokenResponse>(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const expiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000);
      const emailAccountsTable = getTable("emailAccounts", company);
      const [acc] = (await db
        .insert(emailAccountsTable)
        .values({
          userId,
          provider: "google",
          accessToken: token.access_token,
          refreshToken: token.refresh_token || null,
          expiresAt,
        })
        .returning()) as EmailAccountRow[];
      return res.json({ account: acc });
    }

    if (provider === "microsoft") {
      const body = new URLSearchParams({
        code: code as string,
        client_id: getEnv("MS_CLIENT_ID"),
        client_secret: getEnv("MS_CLIENT_SECRET"),
        redirect_uri: getEnv("MS_REDIRECT_URL"),
        grant_type: "authorization_code",
      });
      const token = await fetchJson<OAuthTokenResponse>(MS_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const expiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000);
      const emailAccountsTable = getTable("emailAccounts", company);
      const [acc] = (await db
        .insert(emailAccountsTable)
        .values({
          userId,
          provider: "microsoft",
          accessToken: token.access_token,
          refreshToken: token.refresh_token || null,
          expiresAt,
        })
        .returning()) as EmailAccountRow[];
      return res.json({ account: acc });
    }

    return res.status(400).json({ error: "Unsupported provider" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

async function getAccount(userId: string, provider: "google" | "microsoft", company?: string) {
  const emailAccountsTable = getTable("emailAccounts", company);
  const rows = (await db
    .select()
    .from(emailAccountsTable)
    .where(eq(emailAccountsTable.userId, userId))) as EmailAccountRow[];
  const acc = rows.find((a) => a.provider === provider);
  if (!acc) throw new Error("No connected account");
  return acc;
}

async function refreshAccessTokenIfNeeded(acc: any, company?: string): Promise<any> {
  const now = Date.now();
  const exp = acc.expiresAt ? new Date(acc.expiresAt).getTime() : 0;
  const shouldRefresh = !exp || exp - now < 60000;
  if (!shouldRefresh || !acc.refreshToken) return acc;
  
  const emailAccountsTable = getTable("emailAccounts", company);

  if (acc.provider === "google") {
    const body = new URLSearchParams({
      client_id: getEnv("GOOGLE_CLIENT_ID"),
      client_secret: getEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: acc.refreshToken,
    });
    const token = await fetchJson<OAuthTokenResponse>(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const expiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000);
    const [updated] = (await db
      .update(emailAccountsTable)
      .set({
        accessToken: token.access_token,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(emailAccountsTable.id, acc.id))
      .returning()) as EmailAccountRow[];
    return updated;
  }
  if (acc.provider === "microsoft") {
    const body = new URLSearchParams({
      client_id: getEnv("MS_CLIENT_ID"),
      client_secret: getEnv("MS_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: acc.refreshToken,
    });
    const token = await fetchJson<OAuthTokenResponse>(MS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const expiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000);
    const [updated] = (await db
      .update(emailAccountsTable)
      .set({
        accessToken: token.access_token,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(emailAccountsTable.id, acc.id))
      .returning()) as EmailAccountRow[];
    return updated;
  }
  return acc;
}

async function getFreshAccount(userId: string, provider: "google" | "microsoft", company?: string) {
  const acc = await getAccount(userId, provider, company);
  const fresh = await refreshAccessTokenIfNeeded(acc, company);
  return fresh || acc;
}

export const listMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { provider } = req.params as any;
    const { folder = "inbox", limit = "10", pageToken, skip } = req.query as any;
    const acc = await getFreshAccount(req.user!.id, provider, req.user?.company);
    if (provider === "google") {
      const url = new URL(GOOGLE_GMAIL_LIST);
      const labelMap: Record<string, string> = {
        inbox: "INBOX",
        sent: "SENT",
        drafts: "DRAFT",
        trash: "TRASH",
      };
      url.searchParams.set("maxResults", String(limit));
      const labelId = labelMap[String(folder).toLowerCase()] || "INBOX";
      url.searchParams.set("labelIds", labelId);
      if (pageToken) {
        url.searchParams.set("pageToken", String(pageToken));
      }
      const data = await fetchJson<any>(url.toString(), {
        headers: { Authorization: `Bearer ${acc.accessToken}` },
      });
      return res.json({
        messages: data.messages || [],
        paging: {
          limit: Number(limit),
          nextPageToken: data.nextPageToken || null,
        },
      });
    }
    if (provider === "microsoft") {
      const folderMap: Record<string, string> = {
        inbox: "Inbox",
        sent: "SentItems",
        drafts: "Drafts",
        trash: "DeletedItems",
      };
      const wellKnown = folderMap[String(folder).toLowerCase()] || "Inbox";
      const msUrl = new URL(`https://graph.microsoft.com/v1.0/me/mailFolders/${wellKnown}/messages`);
      msUrl.searchParams.set("$top", String(limit));
      if (skip !== undefined) {
        msUrl.searchParams.set("$skip", String(skip));
      }
      const data = await fetchJson<any>(msUrl.toString(), {
        headers: { Authorization: `Bearer ${acc.accessToken}` },
      });
      return res.json({
        messages: data.value || [],
        paging: {
          limit: Number(limit),
          nextLink: data["@odata.nextLink"] || null,
        },
      });
    }
    return res.status(400).json({ error: "Unsupported provider" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { provider, id } = req.params as any;
    const acc = await getFreshAccount(req.user!.id, provider, req.user?.company);
    if (provider === "google") {
      const data = await fetchJson<any>(GOOGLE_GMAIL_GET(id), {
        headers: { Authorization: `Bearer ${acc.accessToken}` },
      });
      return res.json({ message: data });
    }
    if (provider === "microsoft") {
      const data = await fetchJson<any>(MS_GRAPH_GET(id), {
        headers: { Authorization: `Bearer ${acc.accessToken}` },
      });
      return res.json({ message: data });
    }
    return res.status(400).json({ error: "Unsupported provider" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { provider } = req.params as any;
    const acc = await getFreshAccount(req.user!.id, provider, req.user?.company);
    const { subject, bodyText, to = [], cc = [], bcc = [], attachments = [] } = req.body as any;
    if (!subject || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ error: "Subject and recipients required" });
    }
    if (provider === "google") {
      const boundary = "mixed_" + Math.random().toString(36).slice(2);
      const head =
        `To: ${to.join(", ")}\r\n` +
        (Array.isArray(cc) && cc.length ? `Cc: ${cc.join(", ")}\r\n` : "") +
        (Array.isArray(bcc) && bcc.length ? `Bcc: ${bcc.join(", ")}\r\n` : "") +
        `Subject: ${subject}\r\n` +
        `MIME-Version: 1.0\r\n` +
        `Content-Type: multipart/mixed; boundary=${boundary}\r\n\r\n`;
      const textPart =
        `--${boundary}\r\n` +
        `Content-Type: text/plain; charset=\"UTF-8\"\r\n\r\n` +
        `${bodyText || ""}\r\n`;
      let attachParts = "";
      if (Array.isArray(attachments) && attachments.length) {
        for (const a of attachments) {
          const name = a.filename || a.name || "attachment";
          const type = a.contentType || "application/octet-stream";
          const b64 = a.contentBase64 || a.content || "";
          attachParts +=
            `--${boundary}\r\n` +
            `Content-Type: ${type}; name=\"${name}\"\r\n` +
            `Content-Transfer-Encoding: base64\r\n` +
            `Content-Disposition: attachment; filename=\"${name}\"\r\n\r\n` +
            `${b64}\r\n`;
        }
      }
      const tail = `--${boundary}--`;
      const raw = head + textPart + attachParts + tail;
      const encoded = Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
      const data = await fetchJson<any>("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${acc.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encoded }),
      });
      return res.status(201).json({ result: data });
    }
    if (provider === "microsoft") {
      const payload = {
        message: {
          subject,
          body: { contentType: "Text", content: bodyText || "" },
          toRecipients: to.map((email: string) => ({ emailAddress: { address: email } })),
          ccRecipients: Array.isArray(cc) ? cc.map((email: string) => ({ emailAddress: { address: email } })) : [],
          bccRecipients: Array.isArray(bcc) ? bcc.map((email: string) => ({ emailAddress: { address: email } })) : [],
          attachments:
            Array.isArray(attachments) && attachments.length
              ? attachments.map((a: any) => ({
                  "@odata.type": "#microsoft.graph.fileAttachment",
                  name: a.filename || a.name || "attachment",
                  contentType: a.contentType || "application/octet-stream",
                  contentBytes: a.contentBase64 || a.content || "",
                }))
              : [],
        },
        saveToSentItems: "true",
      };
      const data = await fetchJson<any>("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${acc.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      return res.status(201).json({ result: data });
    }
    return res.status(400).json({ error: "Unsupported provider" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { provider, id } = req.params as any;
    const acc = await getFreshAccount(req.user!.id, provider, req.user?.company);
    if (provider === "google") {
      const trashUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/trash`;
      const resDel = await fetch(trashUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${acc.accessToken}` },
      });
      if (!resDel.ok) {
        const text = await resDel.text();
        throw new Error(`HTTP ${resDel.status}: ${text}`);
      }
      return res.json({ success: true });
    }
    if (provider === "microsoft") {
      const resDel = await fetch(MS_GRAPH_GET(id), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${acc.accessToken}` },
      });
      if (!resDel.ok) {
        const text = await resDel.text();
        throw new Error(`HTTP ${resDel.status}: ${text}`);
      }
      return res.json({ success: true });
    }
    return res.status(400).json({ error: "Unsupported provider" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const markRead = async (req: AuthRequest, res: Response) => {
  try {
    const { provider, id } = req.params as any;
    const acc = await getFreshAccount(req.user!.id, provider, req.user?.company);
    if (provider === "google") {
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`;
      const data = await fetchJson<any>(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${acc.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
      });
      return res.json({ result: data });
    }
    if (provider === "microsoft") {
      const data = await fetchJson<any>(MS_GRAPH_GET(id), {
        headers: { Authorization: `Bearer ${acc.accessToken}` },
      });
      const patch = await fetch(MS_GRAPH_GET(id), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${acc.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isRead: true }),
      });
      if (!patch.ok) {
        const text = await patch.text();
        throw new Error(`HTTP ${patch.status}: ${text}`);
      }
      return res.json({ result: { success: true } });
    }
    return res.status(400).json({ error: "Unsupported provider" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getLinkedAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const company = req.user?.company;
    const emailAccountsTable = getTable("emailAccounts", company);
    const rows = (await db
      .select()
      .from(emailAccountsTable)
      .where(eq(emailAccountsTable.userId, userId))) as EmailAccountRow[];
    const providers = rows.map((a) => a.provider);
    res.json({ providers, accounts: rows });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
