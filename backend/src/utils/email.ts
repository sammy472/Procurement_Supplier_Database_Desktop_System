import { db } from "../db";
import * as schema from "../db/schema";
import { getTable, getCompanyFromEmail } from "./dbHelper";
import { eq } from "drizzle-orm";

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: any[];
  from?: string;
}

const MS_AUTH_COMMON = "https://login.microsoftonline.com/common/oauth2/v2.0";
const MS_TOKEN_URL = `${MS_AUTH_COMMON}/token`;

export const sendEmail = async (options: EmailOptions) => {
  const toList = Array.isArray(options.to) ? options.to : [options.to];
  const hasHtml = typeof options.html === "string" && options.html.length > 0;
  const bodyContent = hasHtml ? options.html! : options.text || "";
  const contentType = hasHtml ? "HTML" : "Text";
  const parsedFromEmail = parseEmail(options.from);
  const company = parsedFromEmail ? getCompanyFromEmail(parsedFromEmail) : undefined;

  const message = {
    subject: options.subject,
    body: {
      contentType,
      content: bodyContent,
    },
    toRecipients: toList.map((addr) => ({ emailAddress: { address: addr } })),
    replyTo:
      parsedFromEmail
        ? [{ emailAddress: { address: parsedFromEmail } }]
        : [],
  } as any;

  const graphAttachments = buildGraphAttachments(options.attachments);
  if (graphAttachments.length > 0) {
    message.attachments = graphAttachments;
  }

  const delegatedToken = parsedFromEmail && company ? await getDelegatedTokenForEmail(parsedFromEmail, company).catch(() => null) : null;
  if (delegatedToken) {
    await graphSend("https://graph.microsoft.com/v1.0/me/sendMail", delegatedToken, {
      message,
      saveToSentItems: "true",
    });
    return;
  }

  const appToken = await getAppOnlyToken().catch(() => null);
  const systemSender = process.env.MS_SYSTEM_SENDER_EMAIL || "";
  if (appToken && systemSender) {
    const endpoint = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(systemSender)}/sendMail`;
    await graphSend(endpoint, appToken, {
      message,
      saveToSentItems: "true",
    });
    return;
  }
  throw new Error("Email sending not configured");
};

function parseEmail(from?: string): string | null {
  const v = String(from || "").trim();
  const match = v.match(/<([^>]+)>/);
  if (match && match[1]) return match[1].trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return v;
  return null;
}

function buildGraphAttachments(attachments?: any[]): any[] {
  if (!attachments || !Array.isArray(attachments)) return [];
  const out: any[] = [];
  for (const a of attachments) {
    const name = a?.filename || a?.name || "attachment";
    const ct = a?.contentType || "application/octet-stream";
    const base64 = a?.contentBase64 || a?.contentBytes;
    if (typeof base64 === "string" && base64.length > 0) {
      const att: any = {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name,
        contentType: ct,
        contentBytes: base64,
      };
      if (a?.cid) {
        att.isInline = true;
        att.contentId = a.cid;
      }
      out.push(att);
    }
  }
  return out;
}

async function getDelegatedTokenForEmail(email: string, company: string): Promise<string | null> {
  const usersTable = getTable("users", company);
  const emailAccountsTable = getTable("emailAccounts", company);
  const rows = await db.select().from(usersTable).where(eq((usersTable as any).email, email)).limit(1) as any[];
  if (rows.length === 0) return null;
  const userId = rows[0].id;
  const accRows = await db.select().from(emailAccountsTable).where(eq((emailAccountsTable as any).userId, userId)).limit(10) as any[];
  const msAcc = accRows.find((r) => String(r.provider || "").toLowerCase() === "microsoft");
  if (!msAcc) return null;
  const fresh = await refreshMicrosoftToken(msAcc, company);
  return fresh?.accessToken || null;
}

async function refreshMicrosoftToken(acc: any, company: string): Promise<any> {
  const emailAccountsTable = getTable("emailAccounts", company);
  const now = Date.now();
  const exp = acc.expiresAt ? new Date(acc.expiresAt).getTime() : 0;
  if (exp > now + 60_000) return acc;
  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID || "",
    client_secret: process.env.MS_CLIENT_SECRET || "",
    grant_type: "refresh_token",
    refresh_token: acc.refreshToken || "",
  });
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return acc;
  const token = await res.json() as any;
  const expiresAt = new Date(Date.now() + (token.expires_in || 3600) * 1000);
  const [updated] = await db
    .update(emailAccountsTable)
    .set({
      accessToken: token.access_token,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq((emailAccountsTable as any).id, acc.id))
    .returning() as any[];
  return updated || acc;
}

async function getAppOnlyToken(): Promise<string> {
  const tenant = process.env.MS_TENANT_ID || "";
  const clientId = process.env.MS_APP_CLIENT_ID || "";
  const clientSecret = process.env.MS_APP_CLIENT_SECRET || "";
  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt);
  }
  const data = await res.json() as any;
  return data.access_token;
}

async function graphSend(endpoint: string, token: string, body: any): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt);
  }
}

export function buildBrandedEmail(params: {
  title: string;
  greeting: string;
  paragraphs: string[];
  items?: { label?: string; value: string }[];
  footer?: string;
  logoCid?: string;
  senderName?: string;
  senderPosition?: string;
}) {
  const brandName = process.env.COMPANY_NAME || (process.env.SMTP_FROM || "").replace(/.*<|>.*/g, "").trim() || "Procurement System";
  const logoUrl = process.env.COMPANY_LOGO_URL || "";
  const hasLogo = !!logoUrl;

  const itemsHtml =
    params.items && params.items.length
      ? `<ul style="padding-left:16px;margin:8px 0;color:#0f172a;">
  ${params.items
    .map(
      (it) =>
        `<li style="margin:4px 0;color:#0f172a;">
          ${it.label ? `<strong>${it.label}:</strong> ` : ""}${it.value}
        </li>`
    )
    .join("")}
</ul>`
      : "";

  const paragraphsHtml = params.paragraphs
    .map(
      (p) => `<p style="margin:8px 0;color:#0f172a;">${p}</p>`
    )
    .join("");

  const footerHtml = params.footer
    ? `<p style="margin-top:16px;color:#6b7280;font-size:12px;">${params.footer}</p>`
    : "";

  const html = `
<div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <div style="padding:16px 20px;background:#0f172a;color:#ffffff;font-weight:600;">${brandName}</div>
    <div style="padding:20px;color:#0f172a;">
      <h1 style="margin:0 0 8px 0;font-size:18px;color:#0f172a;">${params.title}</h1>
      <p style="margin:0 0 12px 0;color:#0f172a;">${params.greeting}</p>
      ${paragraphsHtml}
      ${itemsHtml}
      <div style="margin-top:16px;color:#0f172a;">
        <p style="margin:8px 0;">Warm regards,</p>
        ${
          params.senderName
            ? `<p style="margin:4px 0;">${params.senderName}</p>`
            : ""
        }
        ${
          params.senderPosition
            ? `<p style="margin:4px 0;color:#6b7280;">${params.senderPosition}</p>`
            : ""
        }
      </div>
      ${footerHtml}
    </div>
    <div style="padding:0 20px 12px 20px;background:#f3f4f6;color:#6b7280;font-size:12px;">
      ${
        hasLogo
          ? `<img src="${logoUrl}" alt="${brandName}" style="width:100%;height:auto;display:block;margin:0 0 8px 0;">`
          : ""
      }
      © ${new Date().getFullYear()} ${brandName}
    </div>
  </div>
</div>
`;
  return html;
}

export function getBrandAssets() {
  const logoUrl = process.env.COMPANY_LOGO_URL || "";
  if (!logoUrl) {
    return { attachments: [], logoCid: undefined as string | undefined };
  }
  const logoCid = "companylogo";
  let filename = "logo";
  try {
    const u = new URL(logoUrl);
    const base = u.pathname.split("/").pop() || "logo";
    filename = base;
  } catch {
    filename = "logo";
  }
  const attachments = [
    {
      filename,
      path: logoUrl,
      cid: logoCid,
      contentDisposition: "inline",
    },
  ];
  return { attachments, logoCid };
}

export const sendTaskAssignedEmail = async (
  userEmail: string,
  userName: string,
  taskTitle: string,
  tenderTitle: string,
  dueDate: Date | null,
  tenderDueDate: Date | null,
  senderName?: string,
  senderPosition?: string,
  fromEmail?: string
) => {
  const subject = `New Task Assigned: ${taskTitle}`;
  const { attachments, logoCid } = getBrandAssets();
  const html = buildBrandedEmail({
    title: "New Task Assigned",
    greeting: `Hello ${userName},`,
    paragraphs: [
      "You have been assigned a new task.",
      "Please log in to the system to view more details.",
    ],
    items: [
      { label: "Task Title", value: taskTitle },
      {
        label: "Task Due Date",
        value: dueDate ? new Date(dueDate).toDateString() : "No due date",
      },
      { label: "Tender Title", value: tenderTitle },
      {
        label: "Tender Deadline",
        value: tenderDueDate ? new Date(tenderDueDate).toDateString() : "No deadline",
      },
      { label: "Tender Creator", value: senderName || "N/A" },
    ],
    logoCid,
    senderName,
    senderPosition,
  });
  await sendEmail({
    to: userEmail,
    subject,
    html,
    attachments,
    from: fromEmail ? `${senderName || ""} <${fromEmail}>` : undefined,
  });
};

export const sendTaskSubmittedEmail = async (
  to: string | string[],
  taskTitle: string,
  tenderTitle: string,
  submittedBy: string,
  submittedAt: Date,
  senderName?: string,
  senderPosition?: string,
  fromEmail?: string
) => {
  const subject = `Task Submitted: ${taskTitle}`;
  const { attachments, logoCid } = getBrandAssets();
  const html = buildBrandedEmail({
    title: "Task Submitted",
    greeting: "Hello,",
    paragraphs: [
      "A task has been submitted.",
      "Please review the submission and proceed with the next steps as appropriate.",
    ],
    items: [
      { label: "Task Title", value: taskTitle },
      { label: "Tender Title", value: tenderTitle },
      { label: "Submitted By", value: submittedBy },
      { label: "Submitted At", value: submittedAt.toLocaleString() },
      { label: "Tender Creator", value: senderName || "N/A" },
    ],
    logoCid,
    senderName,
    senderPosition,
  });
  await sendEmail({
    to,
    subject,
    html,
    attachments,
    from: fromEmail,
  });
};
