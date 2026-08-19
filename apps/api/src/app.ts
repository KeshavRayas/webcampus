import DepartmentRouter from "@webcampus/api/src/routers/department/department.router";
import { auth, toNodeHandler } from "@webcampus/auth";
import { backendEnv } from "@webcampus/common/env";
import cors from "cors";
import express, { type Express } from "express";
import accountsRouter from "./routers/accounts/accounts.router";
import adminRouter from "./routers/admin/admin.router";
import admissionRouter from "./routers/admission/admission.router";
import coeRouter from "./routers/coe/coe.router";
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

const app: Express = express();

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

app.use("/coe", coeRouter);

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
app.use("/coe/feedback", feedbackReportRouter);

app.use("/files", fileRouter);

app.get("/", (req, res) => {
  res.send({
    message: "Server is Up and Running",
  });
});

export default app;
