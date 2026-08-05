"use client";

import { frontendEnv } from "@webcampus/common/env";
import type { FeedbackReportQuery } from "@webcampus/schemas/feedback";
import axios from "axios";

const baseUrl = () => frontendEnv().NEXT_PUBLIC_API_BASE_URL;

export async function getFeedbackReport(
  query: FeedbackReportQuery,
  role: string
) {
  const response = await axios.get(`${baseUrl()}/${role}/feedback/report`, {
    params: query,
    withCredentials: true,
  });
  return response.data.data;
}

export async function getFeedbackFilterOptions(role: string) {
  const response = await axios.get(
    `${baseUrl()}/${role}/feedback/filter-options`,
    { withCredentials: true }
  );
  return response.data.data as {
    faculty: Array<{ id: string; shortName: string; user: { name: string } }>;
    courses: Array<{ id: string; code: string; name: string }>;
    sections: Array<{ id: string; name: string }>;
    batches: Array<{ id: string; name: string }>;
    rounds: Array<{ id: string; roundNumber: number }>;
  };
}

export function downloadFeedbackCsv(
  rows: Array<Record<string, unknown>>,
  filename = "feedback-report.csv"
) {
  if (!rows.length) return;
  const firstRow = rows[0];
  if (!firstRow) return;
  const headers = Object.keys(firstRow);
  const escape = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header])),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
