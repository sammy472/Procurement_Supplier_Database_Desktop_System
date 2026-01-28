import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import helmet from "helmet";
import { and, eq, sql } from "drizzle-orm";
import authRoutes from "./routes/authRoutes";
import supplierRoutes from "./routes/supplierRoutes";
import materialRoutes from "./routes/materialRoutes";
import quotationRoutes from "./routes/quotationRoutes";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes";
import materialRequestRoutes from "./routes/materialRequestRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import activityLogRoutes from "./routes/activityLogRoutes";
import searchRoutes from "./routes/searchRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import tenderRoutes from "./routes/tenderRoutes";
import rfqRoutes from "./routes/rfqRoutes";
import mailRoutes from "./routes/mailRoutes";
import providerMailRoutes from "./routes/providerMailRoutes";
import { db } from "./db";
import * as schema from "./db/schema";
import { sendEmail, buildBrandedEmail, getBrandAssets, getAnyDelegatedSender } from "./utils/email";
import cron from "node-cron";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Middleware
app.use(helmet());
app.use(cors({ 
  origin: [FRONTEND_URL,"http://localhost:4173/#"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 3600
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Preflight handler for OPTIONS requests
app.options("*", cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Request logging middleware
app.use((req, res, next) => {
  const contentType = req.headers["content-type"] || "none";
  const contentLength = req.headers["content-length"] || "0";
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log(`  Auth: ${req.headers.authorization ? "✓" : "✗"}`);
  console.log(`  Content-Type: ${contentType}`);
  console.log(`  Content-Length: ${contentLength}`);
  next();
});

// Lightweight caching for GET endpoints
app.use((req, res, next) => {
  if (req.method === "GET") {
    const path = req.path || "";
    if (path.startsWith("/api/notifications")) {
      res.setHeader("Cache-Control", "no-store");
    } else {
      res.setHeader("Cache-Control", "private, max-age=30");
    }
  }
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/material-requests", materialRequestRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/tenders", tenderRoutes);
app.use("/api/rfqs", rfqRoutes);
app.use("/api/mails", mailRoutes);
app.use("/api/email/providers", providerMailRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const DAY_MS = 24 * 60 * 60 * 1000;

async function sendTenderTaskRemindersForWindow(minMs?: number, maxMs?: number) {
  try {
    const company = String(process.env.COMPANY_NAME || "").toUpperCase().includes("ANT") ? "ANT_SAVY" : "ONK_GROUP";
    const available = await getAnyDelegatedSender(company);
    if (!available) {
      console.warn("No Microsoft delegated account linked for company; skipping task reminders.");
      return;
    }
    const now = new Date();
    const minDate = typeof minMs === "number" ? new Date(now.getTime() + minMs) : null;
    const maxDate = typeof maxMs === "number" ? new Date(now.getTime() + maxMs) : null;

    const tasks = await db
      .select({
        taskId: schema.tenderTasks.id,
        title: schema.tenderTasks.title,
        dueDate: schema.tenderTasks.dueDate,
        tenderTitle: schema.tenders.title,
        tenderId: schema.tenders.id,
        tenderCreatorId: schema.tenders.createdBy,
        assigneeEmail: schema.users.email,
        assigneeFirstName: schema.users.firstName,
        assigneeLastName: schema.users.lastName,
      })
      .from(schema.tenderTasks)
      .innerJoin(
        schema.tenders,
        eq(schema.tenderTasks.tenderId, schema.tenders.id)
      )
      .innerJoin(
        schema.users,
        eq(schema.tenderTasks.assigneeId, schema.users.id)
      )
      .where(
        and(
          eq(schema.tenderTasks.status, "pending"),
        eq(schema.tenders.status, "active"),
          sql`${schema.tenderTasks.dueDate} IS NOT NULL`,
        sql`(${schema.tenders.deadline} IS NULL OR ${schema.tenders.deadline} >= ${now})`,
          minDate ? sql`${schema.tenderTasks.dueDate} > ${minDate}` : sql`TRUE`,
          maxDate ? sql`${schema.tenderTasks.dueDate} <= ${maxDate}` : sql`TRUE`
        )
      );

    if (tasks.length === 0) {
      return;
    }

    const reminders = new Map<
      string,
      {
        name: string;
        tenderId: string;
        tenderTitle: string;
        tenderCreatorId: string;
        tasks: { title: string; tenderTitle: string; dueDate: Date | null }[];
      }
    >();

    for (const task of tasks) {
      if (!task.assigneeEmail) {
        continue;
      }
      const key = `${task.assigneeEmail.toLowerCase()}|${task.tenderId}`;
      if (!reminders.has(key)) {
        const name = [task.assigneeFirstName, task.assigneeLastName]
          .filter(Boolean)
          .join(" ");
        reminders.set(key, {
          name: name || "User",
          tenderId: task.tenderId as string,
          tenderTitle: task.tenderTitle as string,
          tenderCreatorId: task.tenderCreatorId as string,
          tasks: [],
        });
      }
      reminders.get(key)!.tasks.push({
        title: task.title,
        tenderTitle: task.tenderTitle,
        dueDate: (task.dueDate as Date) || null,
      });
    }

    for (const [key, data] of reminders.entries()) {
      const email = key.split("|")[0];
      const lines = data.tasks.map((task) => {
        const due =
          task.dueDate != null
            ? task.dueDate.toISOString().split("T")[0]
            : "No due date";
        return `- ${task.title} (Tender: ${task.tenderTitle}, Due: ${due})`;
      });

      const text =
        `Hello ${data.name || "User"},` +
        "\n\n" +
        "This is a reminder for your pending tender tasks:\n" +
        lines.join("\n") +
        "\n\n" +
        "Please log in to the procurement system to review and complete them.";
      const { attachments, logoCid } = getBrandAssets();
      const [creator] = await db
        .select({
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
        })
        .from(schema.users)
        .where(eq(schema.users.id, data.tenderCreatorId))
        .limit(1);
      const creatorName = creator ? [creator.firstName, creator.lastName].filter(Boolean).join(" ") : "Tender Creator";
      const html = buildBrandedEmail({
        title: "Pending Tender Task Reminder",
        greeting: `Hello ${data.name || "User"},`,
        paragraphs: [
          "This is a reminder for your pending tender tasks:",
          "Please log in to the procurement system to review and complete them.",
        ],
        items: data.tasks.map((t) => ({
          value: `${t.title} (Tender: ${t.tenderTitle}, Due: ${
            t.dueDate != null ? t.dueDate.toISOString().split("T")[0] : "No due date"
          })`,
        })),
        logoCid,
        senderName: creatorName,
        senderPosition: "Tender Creator",
      });

      await sendEmail({
        to: email,
        subject: "Pending tender task reminder",
        text,
        html,
        attachments,
        from: creator && creator.email ? `${creatorName} <${creator.email}>` : undefined,
      });
    }
  } catch (error) {
    console.error("Error sending tender task reminders:", error);
  }
}

async function sendTenderDeadlineReminders() {
  try {
    const company = String(process.env.COMPANY_NAME || "").toUpperCase().includes("ANT") ? "ANT_SAVY" : "ONK_GROUP";
    const available = await getAnyDelegatedSender(company);
    if (!available) {
      console.warn("No Microsoft delegated account linked for company; skipping deadline reminders.");
      return;
    }
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const tenders = await db
      .select({
        id: schema.tenders.id,
        title: schema.tenders.title,
        deadline: schema.tenders.deadline,
        creatorEmail: schema.users.email,
        creatorFirstName: schema.users.firstName,
        creatorLastName: schema.users.lastName,
      })
      .from(schema.tenders)
      .innerJoin(schema.users, eq(schema.tenders.createdBy, schema.users.id))
      .where(
        and(
          eq(schema.tenders.status, "active"),
          sql`${schema.tenders.deadline} IS NOT NULL`,
          sql`${schema.tenders.deadline} <= ${in24Hours}`,
          sql`${schema.tenders.deadline} >= ${sevenDaysAgo}`
        )
      );

    if (tenders.length === 0) return;

    for (const tender of tenders) {
      if (!tender.creatorEmail) continue;

      const closing = tender.deadline
        ? new Date(tender.deadline).toDateString()
        : "Unknown";

      const subject = `Tender Deadline Reminder: ${tender.title}`;
      const text = `Hello ${
        tender.creatorFirstName || "User"
      },\n\nThis is a reminder that the tender "${
        tender.title
      }" is closing soon (Date: ${closing}).\n\nPlease log in to manage it.`;
      const { attachments, logoCid } = getBrandAssets();
      const creatorName = [tender.creatorFirstName, tender.creatorLastName]
        .filter(Boolean)
        .join(" ") || "Tender Creator";
      const html = buildBrandedEmail({
        title: "Tender Deadline Reminder",
        greeting: `Hello ${tender.creatorFirstName || "User"},`,
        paragraphs: [
          `This is a reminder that the tender "${tender.title}" is closing soon.`,
        ],
        items: [{ label: "Deadline", value: closing }],
        logoCid,
        senderName: creatorName,
        senderPosition: "Tender Creator",
      });

      await sendEmail({
        to: tender.creatorEmail,
        subject,
        text,
        html,
        attachments,
        from: `${creatorName} <${tender.creatorEmail}>`,
      });
    }
  } catch (error) {
    console.error("Error sending tender deadline reminders:", error);
  }
}

async function deactivatePastDueTenders() {
  try {
    const now = new Date();
    await db
      .update(schema.tenders)
      .set({ status: "closed", updatedAt: now })
      .where(and(eq(schema.tenders.status, "active"), sql`${schema.tenders.deadline} IS NOT NULL`, sql`${schema.tenders.deadline} < ${now}`));
  } catch (error) {
    console.error("Error deactivating past due tenders:", error);
  }
}

async function startServer() {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Frontend URL: ${FRONTEND_URL}`);
  });

  await sendTenderTaskRemindersForWindow(0, DAY_MS);
  await sendTenderTaskRemindersForWindow(DAY_MS, DAY_MS * 7);
  await sendTenderTaskRemindersForWindow(DAY_MS * 7);
  await sendTenderDeadlineReminders();
  await deactivatePastDueTenders();
  cron.schedule("*/30 * * * *", async () => {
    await sendTenderTaskRemindersForWindow(0, DAY_MS);
  });
  cron.schedule("0 * * * *", async () => {
    await sendTenderTaskRemindersForWindow(DAY_MS, DAY_MS * 7);
  });
  cron.schedule("0 0 * * *", async () => {
    await sendTenderTaskRemindersForWindow(DAY_MS * 7);
    await sendTenderDeadlineReminders();
    await deactivatePastDueTenders();
  });
  cron.schedule("*/10 * * * *", async () => {
    await deactivatePastDueTenders();
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});
