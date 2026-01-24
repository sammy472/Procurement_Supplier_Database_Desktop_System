import { Response } from "express";
import multer from "multer";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { getTable } from "../utils/dbHelper";
import { eq, and, or, inArray, desc, sql } from "drizzle-orm";
import { logActivity } from "../utils/audit";
import {
  uploadFile,
  deleteFile,
  getSignedUrl,
  STORAGE_BUCKETS,
  generateFilePath,
} from "../utils/supabaseStorage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

export const uploadAttachmentsMiddleware = upload.array("attachments", 5);

type MailMessageRow = typeof schema.mailMessages.$inferSelect;
type MailRecipientRow = typeof schema.mailRecipients.$inferSelect;
type MailAttachmentRow = typeof schema.mailAttachments.$inferSelect;

function sanitizeText(input?: string) {
  if (!input) return "";
  const s = input.toString();
  return s.length > 20000 ? s.substring(0, 20000) : s;
}

export const getMails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { folder = "inbox", limit = 50, offset = 0 } = req.query as any;
    const company = req.user?.company;

    const mailMessagesTable = getTable("mailMessages", company);
    const mailRecipientsTable = getTable("mailRecipients", company);
    const mailAttachmentsTable = getTable("mailAttachments", company);

    let messages: MailMessageRow[] = [];

    if (folder === "inbox") {
      const rows = await db
        .select()
        .from(mailRecipientsTable)
        .innerJoin(
          mailMessagesTable,
          eq(mailRecipientsTable.messageId, mailMessagesTable.id)
        )
        .where(
          and(
            eq(mailRecipientsTable.userId, userId),
            sql`${mailRecipientsTable.deletedAt} IS NULL`
          )
        )
        .orderBy(desc(mailMessagesTable.createdAt))
        .limit(Number(limit));
      messages = rows.map((r) => (r as any).mailMessages) as MailMessageRow[];
    } else if (folder === "sent") {
      messages = (await db
        .select()
        .from(mailMessagesTable)
        .where(
          and(eq(mailMessagesTable.senderId, userId), eq(mailMessagesTable.status, "sent"))
        )
        .orderBy(desc(mailMessagesTable.createdAt))
        .limit(Number(limit))) as MailMessageRow[];
    } else if (folder === "drafts") {
      messages = (await db
        .select()
        .from(mailMessagesTable)
        .where(and(eq(mailMessagesTable.senderId, userId), eq(mailMessagesTable.status, "draft")))
        .orderBy(desc(mailMessagesTable.updatedAt))
        .limit(Number(limit))) as MailMessageRow[];
    } else if (folder === "trash") {
      const rows = await db
        .select()
        .from(mailRecipientsTable)
        .innerJoin(
          mailMessagesTable,
          eq(mailRecipientsTable.messageId, mailMessagesTable.id)
        )
        .where(and(eq(mailRecipientsTable.userId, userId), sql`${mailRecipientsTable.deletedAt} IS NOT NULL`))
        .orderBy(desc(mailRecipientsTable.deletedAt!))
        .limit(Number(limit));
      const senderTrashed = await db
        .select()
        .from(mailMessagesTable)
        .where(and(eq(mailMessagesTable.senderId, userId), eq(mailMessagesTable.status, "trashed")))
        .orderBy(desc(mailMessagesTable.updatedAt))
        .limit(Number(limit));
      messages = [...rows.map((r) => (r as any).mailMessages), ...senderTrashed] as MailMessageRow[];
    } else {
      return res.status(400).json({ error: "Invalid folder" });
    }

    const ids = messages.map((m) => m.id);
    const recipients =
      ids.length === 0
        ? []
        : (await db
            .select()
            .from(mailRecipientsTable)
            .where(inArray(mailRecipientsTable.messageId, ids))) as MailRecipientRow[];
    const attachments =
      ids.length === 0
        ? []
        : (await db
            .select()
            .from(mailAttachmentsTable)
            .where(inArray(mailAttachmentsTable.messageId, ids))) as MailAttachmentRow[];

    const groupedRecipients = new Map<string, MailRecipientRow[]>();
    for (const r of recipients) {
      const arr = groupedRecipients.get(r.messageId) || [];
      arr.push(r);
      groupedRecipients.set(r.messageId, arr);
    }

    const groupedAttachments = new Map<string, MailAttachmentRow[]>();
    for (const a of attachments) {
      const arr = groupedAttachments.get(a.messageId) || [];
      arr.push(a);
      groupedAttachments.set(a.messageId, arr);
    }

    const result = messages.map((m) => ({
      ...m,
      recipients: groupedRecipients.get(m.id) || [],
      attachments: groupedAttachments.get(m.id) || [],
    }));

    res.json({ messages: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMailById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const company = req.user?.company;

    const mailMessagesTable = getTable("mailMessages", company);
    const mailRecipientsTable = getTable("mailRecipients", company);
    const mailAttachmentsTable = getTable("mailAttachments", company);

    const rows = (await db
      .select()
      .from(mailMessagesTable)
      .where(eq(mailMessagesTable.id, id))
      .limit(1)) as MailMessageRow[];
    if (rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }
    const message = rows[0];

    const isSender = message.senderId === userId;
    const recipientRows = (await db
      .select()
      .from(mailRecipientsTable)
      .where(eq(mailRecipientsTable.messageId, id))) as MailRecipientRow[];
    const myRecipient = recipientRows.find((r) => r.userId === userId);
    if (!isSender && myRecipient && myRecipient.deletedAt) {
      return res.status(404).json({ error: "Message not found" });
    }

    const attachmentRows = (await db
      .select()
      .from(mailAttachmentsTable)
      .where(eq(mailAttachmentsTable.messageId, id))) as MailAttachmentRow[];

    res.json({
      message: {
        ...message,
        recipients: recipientRows,
        attachments: attachmentRows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createMail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { subject, bodyText, bodyHtml, status = "sent" } = req.body || {};
    const company = req.user?.company;

    const mailMessagesTable = getTable("mailMessages", company);
    const mailRecipientsTable = getTable("mailRecipients", company);
    const mailAttachmentsTable = getTable("mailAttachments", company);

    const rawTo = (req.body.to ?? req.body["to[]"]) as any;
    const rawCc = (req.body.cc ?? req.body["cc[]"]) as any;
    const rawBcc = (req.body.bcc ?? req.body["bcc[]"]) as any;
    const to = Array.isArray(rawTo)
      ? rawTo
      : typeof rawTo === "string" && rawTo.length
      ? [rawTo]
      : [];
    const cc = Array.isArray(rawCc)
      ? rawCc
      : typeof rawCc === "string" && rawCc.length
      ? [rawCc]
      : [];
    const bcc = Array.isArray(rawBcc)
      ? rawBcc
      : typeof rawBcc === "string" && rawBcc.length
      ? [rawBcc]
      : [];

    if (!subject || typeof subject !== "string") {
      return res.status(400).json({ error: "Subject is required" });
    }

    const [message] = (await db
      .insert(mailMessagesTable)
      .values({
        senderId: userId,
        subject,
        bodyText: sanitizeText(bodyText),
        bodyHtml: sanitizeText(bodyHtml),
        status: status === "draft" ? "draft" : "sent",
      })
      .returning()) as MailMessageRow[];

    const recipientsToCreate: Partial<MailRecipientRow>[] = [];
    const addRecipients = (ids: string[], type: "to" | "cc" | "bcc") => {
      for (const rid of ids) {
        recipientsToCreate.push({
          messageId: message.id,
          userId: rid,
          type,
        } as any);
      }
    };
    addRecipients(Array.isArray(to) ? to : [], "to");
    addRecipients(Array.isArray(cc) ? cc : [], "cc");
    addRecipients(Array.isArray(bcc) ? bcc : [], "bcc");

    if (recipientsToCreate.length > 0) {
      await db.insert(mailRecipientsTable).values(recipientsToCreate as any);
    }

    const files = (req.files as Express.Multer.File[]) || [];
    const uploaded: MailAttachmentRow[] = [];
    for (const file of files) {
      const filePath = generateFilePath(`mail-message-${message.id}`, file.originalname, userId);
      const { path } = await uploadFile(
        STORAGE_BUCKETS.GENERAL_DOCUMENTS,
        filePath,
        file.buffer,
        file.mimetype
      );
      const [att] = (await db
        .insert(mailAttachmentsTable)
        .values({
          messageId: message.id,
          fileName: file.originalname,
          filePath: path,
          fileType: file.mimetype,
          uploadedBy: userId,
        })
        .returning()) as MailAttachmentRow[];
      uploaded.push(att);
    }

    await logActivity({
      userId,
      action: "create",
      entityType: "mail_message",
      entityId: message.id,
      description: `Created ${message.status} message`,
      newValue: { subject },
      req: req as any,
    });

    res.status(201).json({
      message: {
        ...message,
        recipients: recipientsToCreate,
        attachments: uploaded,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateMail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { subject, bodyText, bodyHtml, status } = req.body || {};
    const company = req.user?.company;

    const mailMessagesTable = getTable("mailMessages", company);

    const rows = (await db
      .select()
      .from(mailMessagesTable)
      .where(eq(mailMessagesTable.id, id))
      .limit(1)) as MailMessageRow[];
    if (rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }
    const message = rows[0];
    if (message.senderId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [updated] = (await db
      .update(mailMessagesTable)
      .set({
        subject: typeof subject === "string" ? subject : message.subject,
        bodyText: typeof bodyText === "string" ? sanitizeText(bodyText) : message.bodyText,
        bodyHtml: typeof bodyHtml === "string" ? sanitizeText(bodyHtml) : message.bodyHtml,
        status:
          status && ["draft", "sent", "archived", "trashed"].includes(status)
            ? status
            : message.status,
        updatedAt: new Date(),
      })
      .where(eq(mailMessagesTable.id, id))
      .returning()) as MailMessageRow[];

    res.json({ message: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteMail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const company = req.user?.company;

    const mailMessagesTable = getTable("mailMessages", company);
    const mailRecipientsTable = getTable("mailRecipients", company);

    const rows = (await db
      .select()
      .from(mailMessagesTable)
      .where(eq(mailMessagesTable.id, id))
      .limit(1)) as MailMessageRow[];
    if (rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }
    const message = rows[0];

    if (message.senderId === userId) {
      await db
        .update(mailMessagesTable)
        .set({ status: "trashed", updatedAt: new Date() })
        .where(eq(mailMessagesTable.id, id));
    } else {
      await db
        .update(mailRecipientsTable)
        .set({ deletedAt: new Date() })
        .where(and(eq(mailRecipientsTable.messageId, id), eq(mailRecipientsTable.userId, userId)));
    }

    await logActivity({
      userId,
      action: "delete",
      entityType: "mail_message",
      entityId: id,
      description: "Message moved to trash",
      req: req as any,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const company = req.user?.company;

    const mailRecipientsTable = getTable("mailRecipients", company);

    await db
      .update(mailRecipientsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(mailRecipientsTable.messageId, id), eq(mailRecipientsTable.userId, userId)));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAttachmentUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const company = req.user?.company;

    const mailAttachmentsTable = getTable("mailAttachments", company);

    const rows = (await db
      .select()
      .from(mailAttachmentsTable)
      .where(eq(mailAttachmentsTable.id, id))
      .limit(1)) as MailAttachmentRow[];
    if (rows.length === 0) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    const att = rows[0];
    const url = await getSignedUrl(STORAGE_BUCKETS.GENERAL_DOCUMENTS, att.filePath, 3600 * 24);
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
