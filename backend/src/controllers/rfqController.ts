import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getTable } from "../utils/dbHelper";
import { logActivity } from "../utils/audit";
import { buildBrandedEmail, getBrandAssets, sendEmail } from "../utils/email";

type RfqRow = typeof schema.rfqs.$inferSelect;

function autoCloseStatus(status: string, closeDate: Date | null): string {
  if (status !== "closed" && closeDate && closeDate.getTime() < Date.now()) {
    return "closed";
  }
  return status;
}

export const getRfqs = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const company = req.user?.company;
    const { status } = req.query;
    const limitParam = Math.min(Math.max(parseInt((req.query.limit as string) || "0"), 0), 200);
    const offsetParam = Math.max(parseInt((req.query.offset as string) || "0"), 0);

    const rfqsTable = getTable("rfqs", company);
    const assignmentsTable = getTable("rfqAssignments", company);

    if (role === "admin" || role === "procurement_officer") {
      const baseQuery = db
        .select({
          ...rfqsTable,
          creatorFirstName: schema.users.firstName,
          creatorLastName: schema.users.lastName,
        })
        .from(rfqsTable)
        .leftJoin(schema.users, eq(rfqsTable.createdBy, schema.users.id))
        .orderBy(desc(rfqsTable.createdAt));
      let qb: any = baseQuery;
      if (status) qb = qb.where(eq(rfqsTable.status, status as any));
      if (limitParam > 0) qb = qb.limit(limitParam);
      if (offsetParam > 0) qb = qb.offset(offsetParam);
      const items = (await qb) as any[];
      const updated: any[] = [];
      for (const rfq of items) {
        const newStatus = autoCloseStatus(rfq.status, rfq.closeDate);
        if (newStatus !== rfq.status) {
          const [u] = await db
            .update(rfqsTable)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(rfqsTable.id, rfq.id))
            .returning();
          updated.push(u);
        }
      }
      return res.json({ rfqs: items });
    }

    const assignedRfqIdsRows = (await db
      .select({ rfqId: assignmentsTable.rfqId })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.assigneeId, userId))) as { rfqId: string }[];
    const assignedRfqIds = Array.from(new Set(assignedRfqIdsRows.map((r) => r.rfqId)));

    const baseFilter = or(
      eq(rfqsTable.createdBy, userId),
      assignedRfqIds.length > 0 ? inArray(rfqsTable.id, assignedRfqIds) : eq(rfqsTable.id, "__none__")
    );
    const filter = status ? and(eq(rfqsTable.status, status as any), baseFilter) : baseFilter;

    const baseQuery = db
      .select({
        ...rfqsTable,
        creatorFirstName: schema.users.firstName,
        creatorLastName: schema.users.lastName,
      })
      .from(rfqsTable)
      .leftJoin(schema.users, eq(rfqsTable.createdBy, schema.users.id))
      .where(filter)
      .orderBy(desc(rfqsTable.createdAt));
    let qb: any = baseQuery;
    if (limitParam > 0) qb = qb.limit(limitParam);
    if (offsetParam > 0) qb = qb.offset(offsetParam);
    const items = await qb;
    for (const rfq of items as any[]) {
      const newStatus = autoCloseStatus(rfq.status, rfq.closeDate);
      if (newStatus !== rfq.status) {
        await db
          .update(rfqsTable)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(rfqsTable.id, rfq.id));
      }
    }
    res.json({ rfqs: items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getRfq = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;
    const company = req.user?.company;

    const rfqsTable = getTable("rfqs", company);
    const assignmentsTable = getTable("rfqAssignments", company);

    const rfqsRows = await db
      .select({
        ...rfqsTable,
        creatorFirstName: schema.users.firstName,
        creatorLastName: schema.users.lastName,
      })
      .from(rfqsTable)
      .leftJoin(schema.users, eq(rfqsTable.createdBy, schema.users.id))
      .where(eq(rfqsTable.id, id))
      .limit(1);
    if (rfqsRows.length === 0) {
      return res.status(404).json({ error: "RFQ not found" });
    }
    const rfq = rfqsRows[0];
    const newStatus = autoCloseStatus(rfq.status, rfq.closeDate);
    if (newStatus !== rfq.status) {
      await db
        .update(rfqsTable)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(rfqsTable.id, rfq.id));
      rfq.status = newStatus as any;
    }

    const assignments = await db
      .select({
        id: assignmentsTable.id,
        assigneeId: assignmentsTable.assigneeId,
        assignedAt: assignmentsTable.assignedAt,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
      })
      .from(assignmentsTable)
      .leftJoin(schema.users, eq(assignmentsTable.assigneeId, schema.users.id))
      .where(eq(assignmentsTable.rfqId, id))
      .orderBy(desc(assignmentsTable.assignedAt));

    const isCreator = rfq.createdBy === userId;
    const allowed =
      role === "admin" ||
      role === "procurement_officer" ||
      isCreator ||
      assignments.some((a) => a.assigneeId === userId);
    if (!allowed) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json({ rfq, assignments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createRfq = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const company = req.user?.company;
    const rfqsTable = getTable("rfqs", company);
    const assignmentsTable = getTable("rfqAssignments", company);

    const { subject, senderAddress, items, openDate, closeDate, assigneeIds } = req.body;
    if (!subject || !senderAddress || !openDate || !closeDate || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [rfq] = (await db
      .insert(rfqsTable)
      .values({
        subject,
        senderAddress,
        items,
        openDate: new Date(openDate),
        closeDate: new Date(closeDate),
        status: "active",
        createdBy: userId,
      })
      .returning()) as RfqRow[];

    if (Array.isArray(assigneeIds) && assigneeIds.length > 0) {
      const values = Array.from(new Set(assigneeIds))
        .filter((id: string) => !!id)
        .map((id: string) => ({
          rfqId: rfq.id,
          assigneeId: id,
        }));
      if (values.length > 0) {
        await db.insert(assignmentsTable).values(values);
      }

      const users = await db
        .select()
        .from(schema.users)
        .where(inArray(schema.users.id, values.map((v) => v.assigneeId)));
      const [creator] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      const creatorName = creator ? `${creator.firstName} ${creator.lastName}`.trim() : "RFQ Creator";
      const senderPosition = creator ? creator.role : undefined;
      const { attachments, logoCid } = getBrandAssets();
      for (const u of users) {
        if (!u.email) continue;
        try {
          const itemSummary = (items || []).slice(0, 5).map((it: any, idx: number) => {
            const pn = it.partNumber ? `Part: ${it.partNumber}` : "";
            const sn = it.serialNumber ? `Serial: ${it.serialNumber}` : "";
            const meta = [pn, sn].filter(Boolean).join(" | ");
            const qty = typeof it.quantity === "number" ? `Qty: ${it.quantity}` : "";
            const info = [it.description || "", qty, meta].filter(Boolean).join(" — ");
            return { label: `Item ${idx + 1}`, value: info };
          });
          const html = buildBrandedEmail({
            title: "RFQ Assigned",
            greeting: `Hello ${[u.firstName, u.lastName].filter(Boolean).join(" ") || "Member"},`,
            paragraphs: [
              "You have been assigned to a new Request for Quotation (RFQ).",
              "Review the RFQ details below, then proceed in the system to work on it.",
            ],
            items: [
              { label: "Subject", value: subject },
              { label: "Sender Address", value: senderAddress },
              { label: "Open Date", value: new Date(openDate).toDateString() },
              { label: "Closing Date", value: new Date(closeDate).toDateString() },
              { label: "Status", value: "active" },
              { label: "Items Count", value: String((items || []).length) },
              ...itemSummary,
            ],
            logoCid,
            senderName: creatorName,
            senderPosition,
          });
          await sendEmail({
            to: u.email,
            subject: "New RFQ Assigned",
            html,
            attachments,
            from: creator && creator.email ? `${creatorName} <${creator.email}>` : undefined,
          });
        } catch (e) {
          console.error("RFQ assignment email failed", u.email, e);
        }
      }
    }

    await logActivity({
      userId,
      action: "create",
      entityType: "rfq",
      entityId: rfq.id,
      description: "Created RFQ",
      newValue: rfq as any,
      req: req as any,
    });

    res.status(201).json({ rfq });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateRfq = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const company = req.user?.company;
    const userId = req.user!.id;
    const rfqsTable = getTable("rfqs", company);
    const assignmentsTable = getTable("rfqAssignments", company);

    const existingRows = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id)).limit(1);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: "RFQ not found" });
    }
    const previous = existingRows[0];

    const { subject, senderAddress, items, openDate, closeDate, status, assigneeIds } = req.body;

    if (status === "sent" && previous.closeDate && new Date(previous.closeDate).getTime() < Date.now()) {
      return res.status(400).json({ error: "Cannot mark resolved after the closing date" });
    }

    const [rfq] = await db
      .update(rfqsTable)
      .set({
        ...(subject ? { subject } : {}),
        ...(senderAddress ? { senderAddress } : {}),
        ...(Array.isArray(items) ? { items } : {}),
        ...(openDate ? { openDate: new Date(openDate) } : {}),
        ...(closeDate ? { closeDate: new Date(closeDate) } : {}),
        ...(status ? { status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(rfqsTable.id, id))
      .returning();

    if (Array.isArray(assigneeIds)) {
      const current = await db.select().from(assignmentsTable).where(eq(assignmentsTable.rfqId, id));
      const currentIds = new Set(current.map((c: any) => c.assigneeId));
      const desiredIds = new Set(assigneeIds.filter((x: string) => !!x));
      const toAdd = Array.from(desiredIds).filter((x) => !currentIds.has(x));
      const toRemove = Array.from(currentIds).filter((x) => !desiredIds.has(x));
      if (toAdd.length > 0) {
        await db.insert(assignmentsTable).values(toAdd.map((x) => ({ rfqId: id, assigneeId: x })));
      }
      if (toRemove.length > 0) {
        await db.delete(assignmentsTable).where(
          and(eq(assignmentsTable.rfqId, id), inArray(assignmentsTable.assigneeId, toRemove))
        );
      }
    }

    let finalAssigneeIds: string[] = [];
    if (Array.isArray(assigneeIds)) {
      finalAssigneeIds = assigneeIds.filter((x: string) => !!x);
    } else {
      const rows = await db.select().from(assignmentsTable).where(eq(assignmentsTable.rfqId, id));
      finalAssigneeIds = rows.map((r: any) => r.assigneeId);
    }
    if (finalAssigneeIds.length > 0) {
      const users = await db.select().from(schema.users).where(inArray(schema.users.id, finalAssigneeIds));
      const [creator] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      const creatorName = creator ? `${creator.firstName} ${creator.lastName}`.trim() : "RFQ Updater";
      const senderPosition = creator ? creator.role : undefined;
      const { attachments, logoCid } = getBrandAssets();
      const changedFields: string[] = [];
      if (previous.subject !== rfq.subject) changedFields.push("subject");
      if (previous.senderAddress !== rfq.senderAddress) changedFields.push("sender address");
      if (String(previous.openDate) !== String(rfq.openDate)) changedFields.push("opening date");
      if (String(previous.closeDate) !== String(rfq.closeDate)) changedFields.push("closing date");
      if (previous.status !== rfq.status) changedFields.push("status");
      const prevItemsCount = Array.isArray(previous.items) ? previous.items.length : 0;
      const newItemsCount = Array.isArray(rfq.items) ? rfq.items.length : 0;
      const itemsChanged = String(previous.items) !== String(rfq.items);
      for (const u of users) {
        if (!u.email) continue;
        try {
          const html = buildBrandedEmail({
            title: "RFQ Updated",
            greeting: `Hello ${[u.firstName, u.lastName].filter(Boolean).join(" ") || "Member"},`,
            paragraphs: [
              "An RFQ you are assigned to has been updated with new details.",
              "Review the updated information below, then proceed in the system to take action.",
            ],
            items: [
              { label: "Subject", value: rfq.subject },
              { label: "Sender Address", value: rfq.senderAddress },
              { label: "Open Date", value: new Date(rfq.openDate as any).toDateString() },
              { label: "Closing Date", value: new Date(rfq.closeDate as any).toDateString() },
              { label: "Status", value: rfq.status as any },
              { label: "Updated Fields", value: changedFields.length ? changedFields.join(", ") : "None" },
              { label: "Items Count", value: `${newItemsCount}` },
              { label: "Items Changed", value: itemsChanged ? `Yes (${prevItemsCount} → ${newItemsCount})` : "No" },
              ...((Array.isArray(rfq.items) ? rfq.items.slice(0, 5) : []).map((it: any, idx: number) => {
                const pn = it.partNumber ? `Part: ${it.partNumber}` : "";
                const sn = it.serialNumber ? `Serial: ${it.serialNumber}` : "";
                const qty = typeof it.quantity === "number" ? `Qty: ${it.quantity}` : "";
                const info = [it.description || "", qty, [pn, sn].filter(Boolean).join(" | ")].filter(Boolean).join(" — ");
                return { label: `Item ${idx + 1}`, value: info };
              })),
            ],
            logoCid,
            senderName: creatorName,
            senderPosition,
          });
          await sendEmail({
            to: u.email,
            subject: "RFQ Updated",
            html,
            attachments,
            from: creator && creator.email ? `${creatorName} <${creator.email}>` : undefined,
          });
        } catch (e) {
          console.error("RFQ update email failed", u.email, e);
        }
      }
    }

    await logActivity({
      userId,
      action: "update",
      entityType: "rfq",
      entityId: id,
      description: "Updated RFQ",
      previousValue: previous as any,
      newValue: rfq as any,
      req: req as any,
    });

    res.json({ rfq });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const toggleResolved = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { resolved } = req.body;
    const company = req.user?.company;
    const rfqsTable = getTable("rfqs", company);
    const existingRows = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id)).limit(1);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: "RFQ not found" });
    }
    const current = existingRows[0];
    if (resolved === true && current.closeDate && new Date(current.closeDate).getTime() < Date.now()) {
      return res.status(400).json({ error: "Cannot mark resolved after the closing date" });
    }
    const nextStatus = resolved === true ? ("sent" as any) : ("active" as any);
    const [rfq] = await db
      .update(rfqsTable)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(rfqsTable.id, id))
      .returning();
    res.json({ rfq });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteRfq = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const company = req.user?.company;
    const userId = req.user!.id;
    const rfqsTable = getTable("rfqs", company);
    const rows = await db.select().from(rfqsTable).where(eq(rfqsTable.id, id)).limit(1);
    if (rows.length === 0) {
      return res.status(404).json({ error: "RFQ not found" });
    }
    const previous = rows[0];
    const deletedRows = await db.delete(rfqsTable).where(eq(rfqsTable.id, id)).returning() as RfqRow[];
    const deleted = deletedRows[0];
    await logActivity({
      userId,
      action: "delete",
      entityType: "rfq",
      entityId: id,
      description: "Deleted RFQ",
      previousValue: previous as any,
      req: req as any,
    });
    res.json({ rfq: deleted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
