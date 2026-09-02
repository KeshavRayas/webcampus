export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = "text/csv;charset=utf-8;"
) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

export function downloadJsonFile(data: unknown, filename: string) {
  downloadTextFile(
    JSON.stringify(data, null, 2),
    filename,
    "application/json;charset=utf-8;"
  );
}
