import multer from "multer";

const DEFAULT_FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DEFAULT_FILE_SIZE_LIMIT },
});
