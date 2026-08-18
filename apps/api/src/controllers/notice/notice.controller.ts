import { NoticeService } from "@webcampus/api/src/services/notice/notice.service";
import { getDepartmentRequestContext } from "@webcampus/api/src/utils/request-context";
import type { Request, Response } from "express";
import { z } from "zod";

const noticeSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  audience: z.enum(["STUDENTS", "FACULTY", "BOTH"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});
const statusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});
type RequestWithContext = Request & { requestContext?: { userId?: string } };
const userId = (req: RequestWithContext) => req.requestContext?.userId;
const param = (req: Request, name: string) => {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
};

export const NoticeController = {
  listDepartment: async (req: Request, res: Response) => {
    const context = await getDepartmentRequestContext(req);
    return res.json({
      status: "success",
      data: await NoticeService.listDepartment(
        context.departmentId,
        req.query as { status?: string; audience?: string }
      ),
    });
  },
  listStudents: async (req: RequestWithContext, res: Response) =>
    res.json({
      status: "success",
      data: await NoticeService.listForStudent(
        req.requestContext?.userId ?? ""
      ),
    }),
  listFaculty: async (req: RequestWithContext, res: Response) =>
    res.json({
      status: "success",
      data: await NoticeService.listForFaculty(
        req.requestContext?.userId ?? ""
      ),
    }),
  create: async (req: Request, res: Response) => {
    const parsed = noticeSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          status: "error",
          message: "Invalid notice data",
          details: parsed.error.flatten(),
        });
    const context = await getDepartmentRequestContext(req);
    return res
      .status(201)
      .json({
        status: "success",
        data: await NoticeService.create(
          context.departmentId,
          userId(req)!,
          parsed.data
        ),
      });
  },
  update: async (req: Request, res: Response) => {
    const parsed = noticeSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ status: "error", message: "Invalid notice data" });
    const context = await getDepartmentRequestContext(req);
    return res.json({
      status: "success",
      data: await NoticeService.update(
        context.departmentId,
        param(req, "noticeId")!,
        parsed.data
      ),
    });
  },
  remove: async (req: Request, res: Response) => {
    const context = await getDepartmentRequestContext(req);
    await NoticeService.remove(context.departmentId, param(req, "noticeId")!);
    return res.json({ status: "success", message: "Notice deleted" });
  },
  setStatus: async (req: Request, res: Response) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ status: "error", message: "Invalid notice status" });
    const context = await getDepartmentRequestContext(req);
    return res.json({
      status: "success",
      data: await NoticeService.setStatus(
        context.departmentId,
        param(req, "noticeId")!,
        parsed.data.status
      ),
    });
  },
};
