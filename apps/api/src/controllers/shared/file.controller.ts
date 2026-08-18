import {
  createSignedDownloadUrl,
  createSignedViewUrl,
} from "@webcampus/api/src/utils/s3";
import { logger } from "@webcampus/common/logger";
import { Request, Response } from "express";

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
