import DepartmentRouter from "@webcampus/api/src/routers/department/department.router";
import { auth, toNodeHandler } from "@webcampus/auth";
import { backendEnv } from "@webcampus/common/env";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import accountsRouter from "./routers/accounts/accounts.router";
import adminRouter from "./routers/admin/admin.router";
import admissionRouter from "./routers/admission/admission.router";
import facultyRouter from "./routers/faculty/faculty-domain.router";
import {
  adminFeedbackRouter,
  feedbackReportRouter,
} from "./routers/feedback.router";
import fileRouter from "./routers/file-management/file.router";
import hodRouter from "./routers/hod/hod.router";
import noticeRouter from "./routers/notice/notice.router";
import studentRouter from "./routers/student/student-domain.router";
import supportRouter from "./routers/support/support.router";
import timetableRouter from "./routers/timetable/timetable.router";
import verificationRouter from "./routers/verification/verification.router";
import {
  metricsContentType,
  metricsMiddleware,
  renderMetrics,
} from "./utils/metrics";

const app: Express = express();

app.use(metricsMiddleware);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin: backendEnv().FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);
app.all("/api/auth/{*any}", toNodeHandler(auth));

/**
 * Mount express json middleware after Better Auth handler
 **/
app.use(express.json());

app.use("/admin", adminRouter);

app.use("/hod", hodRouter);

app.use("/department", DepartmentRouter);

app.use("/timetable", timetableRouter);
app.use("/notices", noticeRouter);

app.use("/faculty", facultyRouter);

app.use("/accounts", accountsRouter);

app.use("/support", supportRouter);

app.use("/admission", admissionRouter);

app.use("/student", studentRouter);
app.use("/verification", verificationRouter);
app.use("/admin/feedback", adminFeedbackRouter);
app.use("/faculty/feedback", feedbackReportRouter);
app.use("/hod/feedback", feedbackReportRouter);
app.use("/department/feedback", feedbackReportRouter);

app.use("/files", fileRouter);

app.get("/", (req, res) => {
  res.send({
    message: "Server is Up and Running",
  });
});

// Scraped by Prometheus over the Docker network only (never published to the host)
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", metricsContentType);
  res.send(await renderMetrics());
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Not Found" });
});

// Global error handler — never leak stack traces in production
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    void _next;
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status: number }).status
        : 500;
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    // In production, hide internal details for 500s
    const safeMessage =
      status === 500 && process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : message;
    res.status(status).json({ status: "error", message: safeMessage });
  }
);

export default app;
