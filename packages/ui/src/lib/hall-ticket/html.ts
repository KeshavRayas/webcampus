import QRCode from "qrcode";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { HallTicketTemplate, HallTicketTemplateData } from "./template";

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function hallTicketHtml(
  data: HallTicketTemplateData,
  logoUrl: string
): Promise<string> {
  const qrDataUrl = data.qrPayload
    ? await QRCode.toDataURL(data.qrPayload, {
        width: 130,
        margin: 1,
      })
    : "";

  const vNode = createElement(HallTicketTemplate, {
    data,
    logoUrl,
    qrDataUrl,
  });

  const bodyHtml = renderToString(vNode);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Hall Ticket - ${escHtml(data.student.usn)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print {
    body { margin: 0; padding: 0; }
  }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}
