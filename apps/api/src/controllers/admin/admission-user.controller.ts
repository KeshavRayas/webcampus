import { AdminAdmissionUserService } from "@webcampus/api/src/services/admin/admission-user.service";
import { Request, Response } from "express";

// IMPORTANT: Adjust this path to wherever your s3.ts file actually lives!
// import { generateFileName, uploadToS3 } from "../../utils/s3";

interface ErrorResponseBody {
  status: "error";
  message: string;
  error: string;
}

export class AdminAdmissionUserController {
  static async create(req: Request, res: Response) {
    try {
      // --- NEW S3 UPLOAD LOGIC ---
      // if (req.file) {
      //   const fileName = generateFileName(
      //     req.file.originalname,
      //     "users/photos/"
      //   );
      //   const s3Result = await uploadToS3(
      //     req.file.buffer,
      //     fileName,
      //     req.file.mimetype
      //   );

      //   if (!s3Result.success) {
      //     return res
      //       .status(500)
      //       .json({ status: "error", message: "Image upload failed" });
      //   }

      //   // Attach the public S3 URL to the body so the Service can save it
      //   req.body.photo = s3Result.url;
      // }

      //REMOVED THE UNNCESSARY CHECKS, SINCE ALREADY HANDLED IN SERVICES

      const response = await AdminAdmissionUserService.create(
        req.body,
        req.headers,
        req.file
      );
      return res.status(201).json(response);
    } catch (error) {
      const response: ErrorResponseBody = {
        status: "error",
        message:
          error instanceof Error ? error.message : "Internal server error",
        error: String(error),
      };
      return res.status(400).json(response);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const response = await AdminAdmissionUserService.update(
        id,
        req.body,
        req.headers,
        req.file
      );
      return res.status(200).json(response);
    } catch (error) {
      const response: ErrorResponseBody = {
        status: "error",
        message:
          error instanceof Error ? error.message : "Internal server error",
        error: String(error),
      };
      return res.status(400).json(response);
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      const response = await AdminAdmissionUserService.getAll();
      return res.status(200).json(response);
    } catch (error) {
      const response: ErrorResponseBody = {
        status: "error",
        message:
          error instanceof Error ? error.message : "Internal server error",
        error: String(error),
      };
      return res.status(500).json(response);
    }
  }

  // --- NEW UPDATE METHOD ---
  // static async update(req: Request, res: Response) {
  //   try {
  //     const id = req.params.id as string;

  //     // --- NEW S3 UPLOAD LOGIC ---
  //     if (req.file) {
  //       const fileName = generateFileName(
  //         req.file.originalname,
  //         "users/photos/"
  //       );
  //       const s3Result = await uploadToS3(
  //         req.file.buffer,
  //         fileName,
  //         req.file.mimetype
  //       );

  //       if (!s3Result.success) {
  //         return res
  //           .status(500)
  //           .json({ status: "error", message: "Image upload failed" });
  //       }

  //       // Attach the public S3 URL to the body so the Service can save it
  //       req.body.photo = s3Result.url;
  //     }

  //     // Call the service layer to handle the database update
  //     const response = await AdminAdmissionUserService.update(id, req.body);

  //     return res.status(200).json(response);
  //   } catch (error) {
  //     const response: ErrorResponseBody = {
  //       status: "error",
  //       message:
  //         error instanceof Error ? error.message : "Internal server error",
  //       error: String(error),
  //     };
  //     return res.status(400).json(response);
  //   }
  // }

  static async delete(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const response = await AdminAdmissionUserService.delete(id);
      return res.status(200).json(response);
    } catch (error) {
      const response: ErrorResponseBody = {
        status: "error",
        message:
          error instanceof Error ? error.message : "Internal server error",
        error: String(error),
      };
      return res.status(400).json(response);
    }
  }
}
