import {
  createSignedDownloadUrl,
  createSignedViewUrl,
} from "@webcampus/api/src/utils/s3";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";

function isFileAllowedForRole(key: string, role?: string): boolean {
  if (!role) return false;
  if (role === "admin") return true;

  const top = key.split("/")[0] ?? "";

  // Role -> allowed top-level prefixes (strict ownership)
  const allowMap: Record<string, string[]> = {
    hod: ["department", "faculty", "students", "users", "others"],
    department: ["department", "faculty", "students", "users", "others"],
    faculty: ["faculty", "students", "department", "others", "users"],
    student: ["students", "others", "users"],
    coe: ["users", "students", "others"],
    accounts: ["users", "students", "others"],
    admission: ["users", "students", "others"],
    coordinator: ["department", "faculty", "students", "users", "others"],
    trust: ["department", "users", "others"],
  };

  // Admission files live under users/admission/
  if (key.startsWith("users/admission")) {
    return ["admin", "admission", "department", "hod"].includes(role);
  }
  if (key.startsWith("users/accounts")) {
    return ["admin", "accounts"].includes(role);
  }
  if (key.startsWith("users/coe")) {
    return ["admin", "coe"].includes(role);
  }
  if (key.startsWith("department/")) {
    return ["admin", "hod", "department", "faculty", "coordinator"].includes(
      role
    );
  }
  if (key.startsWith("faculty/")) {
    return ["admin", "hod", "department", "faculty"].includes(role);
  }

  const allowed = allowMap[role];
  if (allowed && allowed.includes(top)) return true;

  // Default: faculty/student can access students/ prefix
  if (
    top === "students" &&
    ["faculty", "department", "hod", "student"].includes(role)
  ) {
    return true;
  }

  return false;
}

export class FileController {
  static async serveFile(req: Request, res: Response): Promise<void> {
    try {
      // req.path contains the sub-path after /files (e.g., "/departments/logo.jpg")
      const key = req.path.replace(/^\//, "");
      const { download } = req.query;

      if (!key) {
        res.status(400).send("File key is required");
        return;
      }

      // Strict ownership check: role must be allowed for key prefix
      const role = (req as unknown as { requestContext?: { role?: string } })
        .requestContext?.role;
      if (!isFileAllowedForRole(key, role)) {
        res.status(403).send("Forbidden: you do not have access to this file");
        return;
      }

      // Note: Expiry is set to 1 hour (3600 seconds) by default.
      const expiresInSeconds = 3600;
      let signedUrl: string;

      if (download === "true") {
        signedUrl = await createSignedDownloadUrl(key, key, expiresInSeconds);
      } else {
        signedUrl = await createSignedViewUrl(key, expiresInSeconds);
      }

      // Redirect the client to the generated presigned S3 URL
      res.redirect(signedUrl);
    } catch (error) {
      logger.error("Failed to serve file", error);
      res.status(500).send("Failed to serve file");
    }
  }
}
