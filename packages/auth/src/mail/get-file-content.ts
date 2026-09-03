import fs from "node:fs/promises";
import path from "node:path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from "@webcampus/common/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type GetFileContentParams = {
  fileName: string;
  variables?: Record<string, string>;
};

/**
 * Reads an HTML file and replaces placeholders (e.g., {RESET_URL}) with actual values.
 *
 * @param fileName - Relative path to the HTML file (e.g. "reset-password.html")
 * @param variables - Key-value pairs to replace in the template
 * @returns HTML string with injected values
 */
export const getFileContent = async ({
  fileName,
  variables = {},
}: GetFileContentParams): Promise<string> => {
  try {
    const absolutePath = path.resolve(__dirname, "../", ...fileName.split("/"));
    let content = await fs.readFile(absolutePath, "utf-8");
    for (const [key, value] of Object.entries(variables)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`{${escapedKey}}`, "g");
      const escapedValue = value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
      content = content.replace(regex, escapedValue);
    }
    return content;
  } catch (err) {
    logger.error(
      `Error reading or processing file "${fileName}":`,
      err as Record<string, unknown>
    );
    throw new Error("Could not load email template.");
  }
};
