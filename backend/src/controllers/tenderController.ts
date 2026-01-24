import { Response, Request, NextFunction } from "express";
import multer from "multer";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "../db/schema";
import { getTable } from "../utils/dbHelper";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { logActivity } from "../utils/audit";
import {
  uploadFile,
  STORAGE_BUCKETS,
  generateFilePath,
  getSignedUrl,
  deleteFile,
  downloadFile,
  listFiles,
} from "../utils/supabaseStorage";
import { sendEmail, sendTaskAssignedEmail, sendTaskSubmittedEmail, buildBrandedEmail, getBrandAssets } from "../utils/email";
import { generateTenderPdf } from "../utils/pdfGenerator";
import { convertOfficeToPdf, mergePdfBuffers, convertImageToPdf } from "../utils/documentMerge";

type TenderRow = typeof schema.tenders.$inferSelect;
type TenderTaskRow = typeof schema.tenderTasks.$inferSelect;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, ZIP"
        )
      );
    }
  },
});

export const uploadTaskFileMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: "File too large. Maximum file size is 10MB.",
          });
        }
        return res.status(400).json({
          error: `File upload error: ${err.message}`,
        });
      }

      if (err.message && err.message.includes("Invalid file type")) {
        return res.status(400).json({
          error: err.message,
        });
      }

      return next(err);
    }
    next();
  });
};

const canViewTender = async (tenderId: string, userId: string, role: string, company?: string | null) => {
  if (role === "admin" || role === "procurement_officer") {
    return true;
  }

  const tendersTable = getTable("tenders", company);
  const tenderTasksTable = getTable("tenderTasks", company);

  const tenders = (await db
    .select()
    .from(tendersTable)
    .where(eq(tendersTable.id, tenderId))
    .limit(1)) as typeof schema.tenders.$inferSelect[];

  if (tenders.length === 0) {
    return false;
  }

  if (tenders[0].createdBy === userId) {
    return true;
  }

  const tasks = (await db
    .select()
    .from(tenderTasksTable)
    .where(
      and(
        eq(tenderTasksTable.tenderId, tenderId),
        eq(tenderTasksTable.assigneeId, userId)
      )
    )
    .limit(1)) as typeof schema.tenderTasks.$inferSelect[];

  return tasks.length > 0;
};

export const getTenders = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const limitParam = Math.min(Math.max(parseInt((req.query.limit as string) || "0"), 0), 200);
    const offsetParam = Math.max(parseInt((req.query.offset as string) || "0"), 0);
    const userId = req.user!.id;
    const role = req.user!.role;
    const company = req.user?.company;

    const tendersTable = getTable("tenders", company);
    const tenderTasksTable = getTable("tenderTasks", company);

    if (role === "admin" || role === "procurement_officer") {
      if (status) {
      const baseQuery = db
          .select({
            ...tendersTable,
            creatorFirstName: schema.users.firstName,
            creatorLastName: schema.users.lastName,
          })
          .from(tendersTable)
          .leftJoin(schema.users, eq(tendersTable.createdBy, schema.users.id))
          .where(eq(tendersTable.status, status as any))
          .orderBy(desc(tendersTable.createdAt));
        let qb: any = baseQuery;
        if (limitParam > 0) qb = qb.limit(limitParam);
        if (offsetParam > 0) qb = qb.offset(offsetParam);
        const items = (await qb) as any[];
        return res.json({ tenders: items });
      }

      const baseQuery = db
        .select({
            ...tendersTable,
            creatorFirstName: schema.users.firstName,
            creatorLastName: schema.users.lastName,
          })
        .from(tendersTable)
        .leftJoin(schema.users, eq(tendersTable.createdBy, schema.users.id))
        .orderBy(desc(tendersTable.createdAt));
      let qb: any = baseQuery;
      if (limitParam > 0) qb = qb.limit(limitParam);
      if (offsetParam > 0) qb = qb.offset(offsetParam);
      const items = (await qb) as any[];

      return res.json({ tenders: items });
    }

    const assignedTenderIdsRows = (await db
      .select({ tenderId: tenderTasksTable.tenderId })
      .from(tenderTasksTable)
      .where(eq(tenderTasksTable.assigneeId, userId))) as { tenderId: string }[];
    const assignedTenderIds = Array.from(
      new Set(assignedTenderIdsRows.map((r) => r.tenderId))
    );

    const baseFilter = or(
      eq(tendersTable.createdBy, userId),
      assignedTenderIds.length > 0
        ? inArray(tendersTable.id, assignedTenderIds)
        : eq(tendersTable.id, "__none__")
    );

    const filter =
      status ? and(eq(tendersTable.status, status as any), baseFilter) : baseFilter;

    const baseQuery = db
      .select({
            ...tendersTable,
            creatorFirstName: schema.users.firstName,
            creatorLastName: schema.users.lastName,
      })
      .from(tendersTable)
      .leftJoin(schema.users, eq(tendersTable.createdBy, schema.users.id))
      .where(filter)
      .orderBy(desc(tendersTable.createdAt));
    let qb: any = baseQuery;
    if (limitParam > 0) qb = qb.limit(limitParam);
    if (offsetParam > 0) qb = qb.offset(offsetParam);
    const items = await qb;

    res.json({ tenders: items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTender = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;
    const company = req.user?.company;

    const allowed = await canViewTender(id, userId, role, company);
    if (!allowed) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const tendersTable = getTable("tenders", company);
    const tenderTasksTable = getTable("tenderTasks", company);

    const tenders = await db
      .select({
        ...tendersTable,
        creatorFirstName: schema.users.firstName,
        creatorLastName: schema.users.lastName,
      })
      .from(tendersTable)
      .leftJoin(schema.users, eq(tendersTable.createdBy, schema.users.id))
      .where(eq(tendersTable.id, id))
      .limit(1);

    if (tenders.length === 0) {
      return res.status(404).json({ error: "Tender not found" });
    }

    const isCreator = tenders[0].createdBy === userId;

    const tasksQuery = db
      .select({
        id: tenderTasksTable.id,
        title: tenderTasksTable.title,
        description: tenderTasksTable.description,
        status: tenderTasksTable.status,
        fileName: tenderTasksTable.fileName,
        filePath: tenderTasksTable.filePath,
        fileType: tenderTasksTable.fileType,
        submittedAt: tenderTasksTable.submittedAt,
        dueDate: tenderTasksTable.dueDate,
        assigneeId: tenderTasksTable.assigneeId,
        assigneeFirstName: schema.users.firstName,
        assigneeLastName: schema.users.lastName,
        assigneeEmail: schema.users.email,
      })
      .from(tenderTasksTable)
      .leftJoin(
        schema.users,
        eq(tenderTasksTable.assigneeId, schema.users.id)
      )
      .where(
        isCreator
          ? eq(tenderTasksTable.tenderId, id)
          : and(
              eq(tenderTasksTable.tenderId, id),
              eq(tenderTasksTable.assigneeId, userId)
            )
      )
      .orderBy(desc(tenderTasksTable.createdAt));

    const tasks = await tasksQuery;

    res.json({ tender: tenders[0], tasks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTender = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const company = req.user?.company;
    const { title, description, deadline, tasks } = req.body;

    if (!title || !deadline) {
      return res.status(400).json({ error: "Title and deadline are required" });
    }

    const tendersTable = getTable("tenders", company);
    const tenderTasksTable = getTable("tenderTasks", company);

    let parsedTasks: any[] = [];
    if (tasks) {
      if (Array.isArray(tasks)) {
        parsedTasks = tasks;
      } else if (typeof tasks === "string") {
        parsedTasks = JSON.parse(tasks);
      }
    }

    const [tender] = (await db
      .insert(tendersTable)
      .values({
        title,
        description,
        deadline: new Date(deadline),
        createdBy: userId,
      })
      .returning()) as TenderRow[];

    if (parsedTasks.length > 0) {
      const taskValues = parsedTasks
        .filter((t) => t && t.title && t.assigneeId)
        .map((t) => ({
          tenderId: tender.id,
          title: t.title,
          description: t.description,
          assigneeId: t.assigneeId,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
        }));

      if (taskValues.length > 0) {
        await db.insert(tenderTasksTable).values(taskValues);
      }
    }

    await logActivity({
      userId,
      action: "create",
      entityType: "tender",
      entityId: tender.id,
      description: `Created tender: ${title}`,
      newValue: tender,
      req: req as any,
    });

    if (parsedTasks.length > 0) {
      const assigneeIds = Array.from(
        new Set(
          parsedTasks
            .filter((t) => t && t.assigneeId)
            .map((t) => t.assigneeId)
        )
      );
      if (assigneeIds.length > 0) {
        const users = await db
          .select()
          .from(schema.users)
          .where(inArray(schema.users.id, assigneeIds));
        const [creator] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);
        const creatorName = creator
          ? `${creator.firstName} ${creator.lastName}`.trim()
          : "Tender Creator";
        const senderPosition = creator ? creator.role : undefined;
        const { attachments, logoCid } = getBrandAssets();
        for (const u of users) {
          if (!u.email) continue;
          const myTasks = parsedTasks.filter((t) => t.assigneeId === u.id);
          const lines = myTasks.map((t: any) => {
            const due =
              t.dueDate ? new Date(t.dueDate).toDateString() : "No due date";
            return `${t.title} (Due: ${due})`;
          });
          const html = buildBrandedEmail({
            title: "New Tender Assigned Tasks",
            greeting: `Hello ${[u.firstName, u.lastName].filter(Boolean).join(" ") || "Member"},`,
            paragraphs: [
              `A new tender "${title}" has been created.`,
              "You have been assigned the following task(s):",
            ],
            items: lines.map((l) => ({ value: l })),
            logoCid,
            senderName: creatorName,
            senderPosition,
          });
          const subject = `Tender Created: ${title}`;
          await sendEmail({
            to: u.email,
            subject,
            html,
            attachments,
            from: creator && creator.email ? `${creatorName} <${creator.email}>` : undefined,
          });
        }
      }
    }

    res.status(201).json({ tender });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTender = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const company = req.user?.company;

    const tendersTable = getTable("tenders", company);

    const existing = (await db
      .select()
      .from(tendersTable)
      .where(eq(tendersTable.id, id))
      .limit(1)) as typeof schema.tenders.$inferSelect[];

    if (existing.length === 0) {
      return res.status(404).json({ error: "Tender not found" });
    }

    if (existing[0].createdBy !== req.user!.id) {
      return res.status(403).json({ error: "Only the creator can update this tender" });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (req.body.title !== undefined) {
      updateData.title = req.body.title;
    }
    if (req.body.description !== undefined) {
      updateData.description = req.body.description;
    }
    if (req.body.deadline !== undefined) {
      const newDeadline = new Date(req.body.deadline);
      updateData.deadline = newDeadline;
      const now = new Date();
      // If deadline is moved to a future date, revive tender to 'active'
      // Do not override an explicitly provided status in the request
      if (newDeadline > now && req.body.status === undefined) {
        updateData.status = "active";
      }
    }
    if (req.body.status !== undefined) {
      updateData.status = req.body.status;
    }

    const [updated] = (await db
      .update(tendersTable)
      .set(updateData)
      .where(eq(tendersTable.id, id))
      .returning()) as TenderRow[];

    await logActivity({
      userId: req.user!.id,
      action: "update",
      entityType: "tender",
      entityId: id,
      description: `Updated tender: ${updated.title}`,
      previousValue: existing[0],
      newValue: updated,
      req: req as any,
    });

    res.json({ tender: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTender = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const company = req.user?.company;

    const tendersTable = getTable("tenders", company);
    const tenderTasksTable = getTable("tenderTasks", company);

    const existing = (await db
      .select()
      .from(tendersTable)
      .where(eq(tendersTable.id, id))
      .limit(1)) as typeof schema.tenders.$inferSelect[];

    if (existing.length === 0) {
      return res.status(404).json({ error: "Tender not found" });
    }

    if (existing[0].createdBy !== req.user!.id) {
      return res.status(403).json({ error: "Only the creator can delete this tender" });
    }

    const tasks = (await db
      .select()
      .from(tenderTasksTable)
      .where(eq(tenderTasksTable.tenderId, id))) as typeof schema.tenderTasks.$inferSelect[];

    for (const task of tasks) {
      if (task.filePath) {
        try {
          await deleteFile(STORAGE_BUCKETS.GENERAL_DOCUMENTS, task.filePath);
        } catch (err) {
          console.warn("Failed to delete task file during tender delete:", err);
        }
      }
    }

    await db.delete(tenderTasksTable).where(eq(tenderTasksTable.tenderId, id));
    await db.delete(tendersTable).where(eq(tendersTable.id, id));

    await logActivity({
      userId: req.user!.id,
      action: "delete",
      entityType: "tender",
      entityId: id,
      description: `Deleted tender: ${existing[0].title}`,
      previousValue: existing[0],
      req: req as any,
    });

    res.json({ message: "Tender deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTenderTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, assigneeId, dueDate } = req.body;
    const company = req.user?.company;

    const tendersTable = getTable("tenders", company);
    const tenderTasksTable = getTable("tenderTasks", company);

    const tenders = (await db
      .select()
      .from(tendersTable)
      .where(eq(tendersTable.id, id))
      .limit(1)) as typeof schema.tenders.$inferSelect[];

    if (tenders.length === 0) {
      return res.status(404).json({ error: "Tender not found" });
    }

    if (tenders[0].createdBy !== req.user!.id) {
      return res.status(403).json({ error: "Only the tender creator can create tasks" });
    }

    if (!title || !assigneeId) {
      return res
        .status(400)
        .json({ error: "Title and assignee are required for a task" });
    }
    const companyEnum =
      company === "ONK_GROUP" || company === "ANT_SAVY" ? company : undefined;
    if (!companyEnum) {
      return res.status(400).json({ error: "Invalid company" });
    }
    const assignees = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, assigneeId), eq(schema.users.company, companyEnum)))
      .limit(1);
    if (assignees.length === 0) {
      return res.status(400).json({ error: "Invalid assignee: user not in this company" });
    }

    const [task] = (await db
      .insert(tenderTasksTable)
      .values({
        tenderId: id,
        title,
        description,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : null,
      })
      .returning()) as TenderTaskRow[];

    await logActivity({
      userId: req.user!.id,
      action: "create",
      entityType: "tender_task",
      entityId: task.id,
      description: `Created task for tender: ${tenders[0].title}`,
      newValue: task,
      req: req as any,
    });

    // Send email notification to assignee
    const [assignee] = (await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, assigneeId))
      .limit(1)) as typeof schema.users.$inferSelect[];

    if (assignee) {
      const [creator] = (await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, tenders[0].createdBy))
        .limit(1)) as typeof schema.users.$inferSelect[];
      const senderName =
        creator ? `${creator.firstName} ${creator.lastName}` : undefined;
      const senderPosition = creator ? creator.role : undefined;
      await sendTaskAssignedEmail(
        assignee.email,
        `${assignee.firstName} ${assignee.lastName}`,
        task.title,
        tenders[0].title,
        task.dueDate,
        tenders[0].deadline,
        senderName,
        senderPosition,
        creator ? creator.email : undefined
      );
    }

    res.status(201).json({ task });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTenderTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const company = req.user?.company;

    const tendersTable = getTable("tenders", company);
    const tenderTasksTable = getTable("tenderTasks", company);

    const existing = (await db
      .select()
      .from(tenderTasksTable)
      .where(eq(tenderTasksTable.id, taskId))
      .limit(1)) as typeof schema.tenderTasks.$inferSelect[];

    if (existing.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const tenderArr = (await db
      .select()
      .from(tendersTable)
      .where(eq(tendersTable.id, existing[0].tenderId))
      .limit(1)) as typeof schema.tenders.$inferSelect[];
    if (tenderArr.length === 0) {
      return res.status(404).json({ error: "Tender not found" });
    }
    if (tenderArr[0].createdBy !== req.user!.id) {
      return res
        .status(403)
        .json({ error: "Only the tender creator can edit tasks" });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (req.body.title !== undefined) {
      updateData.title = req.body.title;
    }
    if (req.body.description !== undefined) {
      updateData.description = req.body.description;
    }
    if (req.body.assigneeId !== undefined) {
      updateData.assigneeId = req.body.assigneeId;
    }
    if (req.body.dueDate !== undefined) {
      updateData.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    }
    // status updates other than 'submitted' are handled via explicit delete endpoint

    const [updated] = (await db
      .update(tenderTasksTable)
      .set(updateData)
      .where(eq(tenderTasksTable.id, taskId))
      .returning()) as TenderTaskRow[];

    await logActivity({
      userId: req.user!.id,
      action: "update",
      entityType: "tender_task",
      entityId: taskId,
      description: `Updated tender task: ${updated.title}`,
      previousValue: existing[0],
      newValue: updated,
      req: req as any,
    });

    // Send email if assignee changed
    if (updated.assigneeId && updated.assigneeId !== existing[0].assigneeId) {
      const [newAssignee] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, updated.assigneeId))
        .limit(1);

      if (newAssignee) {
        const [creator] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, tenderArr[0].createdBy))
          .limit(1);
        const senderName =
          creator ? `${creator.firstName} ${creator.lastName}` : undefined;
        const senderPosition = creator ? creator.role : undefined;
        await sendTaskAssignedEmail(
          newAssignee.email,
          `${newAssignee.firstName} ${newAssignee.lastName}`,
          updated.title,
          tenderArr[0].title,
          updated.dueDate,
          tenderArr[0].deadline,
          senderName,
          senderPosition,
          creator ? creator.email : undefined
        );
      }
    }

    res.json({ task: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTenderTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const company = req.user?.company;

    const tendersTable = getTable("tenders", company);
    const tenderTasksTable = getTable("tenderTasks", company);

    const tasks = (await db
      .select()
      .from(tenderTasksTable)
      .where(eq(tenderTasksTable.id, taskId))
      .limit(1)) as typeof schema.tenderTasks.$inferSelect[];

    if (tasks.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = tasks[0];

    const tenders = (await db
      .select()
      .from(tendersTable)
      .where(eq(tendersTable.id, task.tenderId))
      .limit(1)) as typeof schema.tenders.$inferSelect[];

    if (tenders.length === 0) {
      return res.status(404).json({ error: "Tender not found" });
    }

    if (tenders[0].createdBy !== req.user!.id) {
      return res.status(403).json({ error: "Only the tender creator can delete tasks" });
    }

    if (task.filePath) {
      try {
        await deleteFile(STORAGE_BUCKETS.GENERAL_DOCUMENTS, task.filePath);
      } catch (err) {
        console.warn("Failed to delete task file from storage:", err);
      }
    }

    await db.delete(tenderTasksTable).where(eq(tenderTasksTable.id, taskId));

    await logActivity({
      userId: req.user!.id,
      action: "delete",
      entityType: "tender_task",
      entityId: taskId,
      description: `Deleted tender task: ${task.title}`,
      previousValue: task,
      req: req as any,
    });

    res.json({ message: "Task deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTenderTaskFile = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;
    const company = req.user?.company;

    const tendersTable = getTable("tenders", company);
    const tenderTasksTable = getTable("tenderTasks", company);

    const tasks = await db
      .select()
      .from(tenderTasksTable)
      .where(eq(tenderTasksTable.id, taskId))
      .limit(1);

    if (tasks.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = tasks[0];

    const tenderArr = (await db
      .select()
      .from(tendersTable)
      .where(eq(tendersTable.id, task.tenderId))
      .limit(1)) as typeof schema.tenders.$inferSelect[];
    const tender = tenderArr[0];

    if (task.assigneeId !== userId && tender.createdBy !== userId) {
      return res.status(403).json({ error: "Not allowed to delete this file" });
    }

    if (task.filePath) {
      try {
        await deleteFile(STORAGE_BUCKETS.GENERAL_DOCUMENTS, task.filePath);
      } catch (err) {
        console.warn("Failed to delete task file from storage:", err);
      }
    }

    const [updated] = await db
      .update(tenderTasksTable)
      .set({
        fileName: null,
        filePath: null,
        fileType: null,
        status: "pending",
        submittedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tenderTasksTable.id, taskId))
      .returning();

    await logActivity({
      userId,
      action: "delete",
      entityType: "tender_task_file",
      entityId: taskId,
      description: `Deleted uploaded file for task: ${updated.title}`,
      previousValue: task,
      newValue: updated,
      req: req as any,
    });

    res.json({ task: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const mergeTenderDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const company = req.user?.company;

    const tendersTable = getTable("tenders", company);
    const tenderTasksTable = getTable("tenderTasks", company);

    const tenders = await db.select().from(tendersTable).where(eq(tendersTable.id, id)).limit(1);
    if (tenders.length === 0) {
      return res.status(404).json({ error: "Tender not found" });
    }
    if (tenders[0].createdBy !== req.user!.id) {
      return res.status(403).json({ error: "Only the tender creator can merge documents" });
    }
    const tasks = await db
      .select()
      .from(tenderTasksTable)
      .where(eq(tenderTasksTable.tenderId, id));
    const buffers: Buffer[] = [];
    for (const t of tasks) {
      if (!t.filePath || !t.fileName) continue;
      const ext = (t.fileName.split(".").pop() || "").toLowerCase();
      const buf = await downloadFile(STORAGE_BUCKETS.GENERAL_DOCUMENTS, t.filePath);
      if (ext === "pdf") {
        buffers.push(buf);
    } else if (ext === "docx" || ext === "doc" || ext === "xls" || ext === "xlsx") {
      try {
        const pdfBuf = await convertOfficeToPdf(buf, ext);
        buffers.push(pdfBuf);
      } catch {
        return res
          .status(500)
          .json({ error: "Office conversion failed. Ensure LibreOffice (soffice) is installed or set LIBREOFFICE_PATH." });
      }
    } else if (ext === "jpg" || ext === "jpeg" || ext === "png") {
      const mime =
        t.fileType && t.fileType.includes("image/")
          ? t.fileType
          : ext === "png"
          ? "image/png"
          : "image/jpeg";
      const pdfBuf = await convertImageToPdf(buf, mime);
      buffers.push(pdfBuf);
      }
    }
    if (buffers.length === 0) {
      return res.status(400).json({ error: "No supported documents to merge" });
    }
    const merged = await mergePdfBuffers(buffers);
    const targetPath = `tenders/${id}/merged.pdf`;
    try {
      await deleteFile(STORAGE_BUCKETS.GENERAL_DOCUMENTS, targetPath);
    } catch {}
    const upload = await uploadFile(
      STORAGE_BUCKETS.GENERAL_DOCUMENTS,
      targetPath,
      merged,
      "application/pdf"
    );
    const url = await getSignedUrl(
      STORAGE_BUCKETS.GENERAL_DOCUMENTS,
      targetPath,
      3600
    );
    res.json({ url, path: targetPath });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMergedDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const company = req.user?.company;

    const tendersTable = getTable("tenders", company);

    const tenders = await db.select().from(tendersTable).where(eq(tendersTable.id, id)).limit(1);
    if (tenders.length === 0) {
      return res.status(404).json({ error: "Tender not found" });
    }
    const folder = `tenders/${id}`;
    const files = await listFiles(STORAGE_BUCKETS.GENERAL_DOCUMENTS, folder);
    if (!files.includes("merged.pdf")) {
      return res.status(404).json({ error: "Merged document not found" });
    }
    const url = await getSignedUrl(
      STORAGE_BUCKETS.GENERAL_DOCUMENTS,
      `${folder}/merged.pdf`,
      3600
    );
    res.json({ url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteMergedDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const company = req.user?.company;

    const tendersTable = getTable("tenders", company);

    const tenders = await db.select().from(tendersTable).where(eq(tendersTable.id, id)).limit(1);
    if (tenders.length === 0) {
      return res.status(404).json({ error: "Tender not found" });
    }
    if (tenders[0].createdBy !== req.user!.id) {
      return res.status(403).json({ error: "Only the tender creator can delete merged document" });
    }
    const path = `tenders/${id}/merged.pdf`;
    await deleteFile(STORAGE_BUCKETS.GENERAL_DOCUMENTS, path);
    res.json({ message: "Merged document deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const downloadMergedDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const path = `tenders/${id}/merged.pdf`;
    const folder = `tenders/${id}`;
    const files = await listFiles(STORAGE_BUCKETS.GENERAL_DOCUMENTS, folder);
    if (!files.includes("merged.pdf")) {
      return res.status(404).json({ error: "Merged document not found" });
    }
    const buf = await downloadFile(STORAGE_BUCKETS.GENERAL_DOCUMENTS, path);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="merged_${id}.pdf"`);
    res.send(buf);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
export const uploadTaskFile = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;
    const company = req.user?.company;

    const tendersTable = getTable("tenders", company);
    const tenderTasksTable = getTable("tenderTasks", company);

    const tasks = await db
      .select()
      .from(tenderTasksTable)
      .where(eq(tenderTasksTable.id, taskId))
      .limit(1);

    if (tasks.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = tasks[0];

    const tenderArr = await db
      .select()
      .from(tendersTable)
      .where(eq(tendersTable.id, task.tenderId))
      .limit(1);
    const tender = tenderArr[0];

    if (task.assigneeId !== userId && tender.createdBy !== userId) {
      return res.status(403).json({ error: "Not allowed to upload for this task" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (task.filePath) {
      try {
        await deleteFile(STORAGE_BUCKETS.GENERAL_DOCUMENTS, task.filePath);
      } catch (err) {
        console.warn("Failed to delete previous task file:", err);
      }
    }

    const filePath = generateFilePath(
      `tender-${task.tenderId}-task-${task.id}`,
      req.file.originalname,
      userId
    );

    const { path, url } = await uploadFile(
      STORAGE_BUCKETS.GENERAL_DOCUMENTS,
      filePath,
      req.file.buffer,
      req.file.mimetype
    );

    const [updated] = await db
      .update(tenderTasksTable)
      .set({
        fileName: req.file.originalname,
        filePath: path,
        fileType: req.file.mimetype,
        status: "submitted",
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tenderTasksTable.id, taskId))
      .returning();

    const tenders = (await db
      .select()
      .from(tendersTable)
      .where(eq(tendersTable.id, task.tenderId))
      .limit(1)) as typeof schema.tenders.$inferSelect[];

    await logActivity({
      userId,
      action: "submit",
      entityType: "tender_task",
      entityId: taskId,
      description: `Submitted file for tender task: ${task.title}`,
      previousValue: task,
      newValue: updated,
      req: req as any,
    });

    if (tenders.length > 0) {
      const allTasks = await db
        .select()
        .from(tenderTasksTable)
        .where(eq(tenderTasksTable.tenderId, task.tenderId));

      const assigneeIds = Array.from(
        new Set(allTasks.map((t) => t.assigneeId).concat(tenders[0].createdBy))
      );

      const users = await db
        .select()
        .from(schema.users)
        .where(inArray(schema.users.id, assigneeIds));

      const emails = users.map((u) => u.email).filter((e) => !!e);

      const [submitterUser] = (await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1)) as typeof schema.users.$inferSelect[];
      const submitterName = submitterUser
        ? `${submitterUser.firstName} ${submitterUser.lastName}`.trim()
        : "Member";

      const [creator] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, tenders[0].createdBy))
        .limit(1);
      const senderName = creator ? `${creator.firstName} ${creator.lastName}` : undefined;
      const senderPosition = creator ? creator.role : undefined;
      const senderEmail = creator ? creator.email : undefined;

      if (emails.length > 0) {
        await sendTaskSubmittedEmail(
          emails,
          task.title,
          tenders[0].title,
          submitterName,
          new Date(),
          senderName,
          senderPosition,
          senderEmail
        );
      }
    }

    res.json({
      task: updated,
      fileUrl: url,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTenderTaskFileUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;
    const company = req.user?.company;

    const tendersTable = getTable("tenders", company);
    const tenderTasksTable = getTable("tenderTasks", company);

    const tasks = await db
      .select({
        id: tenderTasksTable.id,
        tenderId: tenderTasksTable.tenderId,
        filePath: tenderTasksTable.filePath,
        fileName: tenderTasksTable.fileName,
        assigneeId: tenderTasksTable.assigneeId,
      })
      .from(tenderTasksTable)
      .where(eq(tenderTasksTable.id, taskId))
      .limit(1);

    if (tasks.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const task = tasks[0];

    const tenderArr = await db
      .select()
      .from(tendersTable)
      .where(eq(tendersTable.id, task.tenderId))
      .limit(1);
    const tender = tenderArr[0];

    if (task.assigneeId !== userId && tender.createdBy !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!task.filePath) {
      return res.status(400).json({ error: "No file uploaded for this task" });
    }

    const url = await getSignedUrl(
      STORAGE_BUCKETS.GENERAL_DOCUMENTS,
      task.filePath,
      3600
    );

    res.json({
      url,
      fileName: task.fileName,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getTenderPdf = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;
    const company = req.user?.company;

    const allowed = await canViewTender(id, userId, role, company);
    if (!allowed) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const tendersTable = getTable("tenders", company);
    const tenderTasksTable = getTable("tenderTasks", company);

    const tenders = await db
      .select()
      .from(tendersTable)
      .where(eq(tendersTable.id, id))
      .limit(1);

    if (tenders.length === 0) {
      return res.status(404).json({ error: "Tender not found" });
    }

    const tasks = (await db
      .select({
        title: tenderTasksTable.title,
        description: tenderTasksTable.description,
        status: tenderTasksTable.status,
        submittedAt: tenderTasksTable.submittedAt,
        fileName: tenderTasksTable.fileName,
        assigneeFirstName: schema.users.firstName,
        assigneeLastName: schema.users.lastName,
      })
      .from(tenderTasksTable)
      .leftJoin(
        schema.users,
        eq(tenderTasksTable.assigneeId, schema.users.id)
      )
      .where(eq(tenderTasksTable.tenderId, id))) as any[];

    await generateTenderPdf(
      {
        id: tenders[0].id,
        title: tenders[0].title,
        description: tenders[0].description || "",
        deadline: tenders[0].deadline.toISOString(),
        status: tenders[0].status,
        createdAt: tenders[0].createdAt.toISOString(),
      },
      tasks,
      res
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
