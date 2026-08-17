"use client";

import React from "react";
import { COLLEGE, type DocData } from "./admission-document";

export type AckDocument = {
  label: string;
  submitted: boolean;
};

export type AckDocumentSource = {
  class10thMarksPdf?: string | null;
  class12thMarksPdf?: string | null;
  diplomaMarksPdf?: string | null;
  transferCertificate?: string | null;
  studyCertificate?: string | null;
  casteCertificate?: string | null;
  disabilityCertificate?: string | null;
  economicallyBackwardCertificate?: string | null;
  feeReceiptNumber?: string | null;
};

export const buildAckDocuments = (source: AckDocumentSource): AckDocument[] => [
  {
    label: "SSLC or 10th Marks Card",
    submitted: Boolean(source.class10thMarksPdf),
  },
  {
    label: "PUC or 12th Marks Card",
    submitted: Boolean(source.class12thMarksPdf),
  },
  {
    label: "Transfer Certificate (TC)",
    submitted: Boolean(source.transferCertificate),
  },
  { label: "Migration Certificate", submitted: false },
  {
    label: "Study Certificate (CET – 7 Years)",
    submitted: Boolean(source.studyCertificate),
  },
  {
    label: "Study Certificate (COMED-K & MGMT – 2 Years)",
    submitted: false,
  },
  {
    label: "Fees Receipt / Allotment Letter",
    submitted: Boolean(source.feeReceiptNumber),
  },
  { label: "Rank Card", submitted: false },
  { label: "Caste Certificate", submitted: Boolean(source.casteCertificate) },
  {
    label: "Income Certificate",
    submitted: Boolean(source.economicallyBackwardCertificate),
  },
  { label: "Rural Certificate (If applicable)", submitted: false },
  { label: "371J Certificate (If applicable)", submitted: false },
  { label: "Domicile Certificate (If applicable)", submitted: false },
  {
    label: "Physically Challenged Certificate",
    submitted: Boolean(source.disabilityCertificate),
  },
  { label: "Defence / NCC / Sports Certificate", submitted: false },
  { label: "Non-Creamy Layer Certificate", submitted: false },
  { label: "Kannada Medium Certificate", submitted: false },
  { label: "Indian Bank Account Number", submitted: false },
];

const value = (data: DocData, key: string, fallback = "—") => {
  const raw = data[key]?.trim();
  return raw ? raw : fallback;
};

const academicYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
};

function AckPage({
  copy,
  data,
  documents,
}: {
  copy: string;
  data: DocData;
  documents: AckDocument[];
}) {
  return (
    <div className="ack-page">
      <div className="ack-letterhead">
        <img
          src="/logo.svg"
          alt="College Logo"
          className="ack-logo"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        <div className="ack-institute">
          <p className="ack-college">{COLLEGE.name}</p>
          <p className="ack-tagline">{COLLEGE.tagline}</p>
          <p className="ack-address">
            {COLLEGE.address}, {COLLEGE.city}, {COLLEGE.state} —{" "}
            {COLLEGE.pincode}
          </p>
        </div>
        <div className="ack-copy-badge">{copy}</div>
      </div>

      <div className="ack-title">Acknowledgement of Application</div>
      <p className="ack-subtitle">
        This is to acknowledge the receipt of your application for admission.
      </p>

      <table className="ack-details">
        <tbody>
          <tr>
            <td className="ack-d-col">
              <div className="ack-d-cell">
                <span className="ack-d-label">Student Name</span>
                <span className="ack-d-colon">:</span>
                <span className="ack-d-value">
                  {value(data, "student_name")}
                </span>
              </div>
            </td>
            <td className="ack-d-col">
              <div className="ack-d-cell">
                <span className="ack-d-label">Date of Admission</span>
                <span className="ack-d-colon">:</span>
                <span className="ack-d-value">
                  {value(data, "date_of_admission", value(data, "date"))}
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td className="ack-d-col">
              <div className="ack-d-cell">
                <span className="ack-d-label">Admission Quota</span>
                <span className="ack-d-colon">:</span>
                <span className="ack-d-value">{value(data, "quota")}</span>
              </div>
            </td>
            <td className="ack-d-col">
              <div className="ack-d-cell">
                <span className="ack-d-label">Year</span>
                <span className="ack-d-colon">:</span>
                <span className="ack-d-value">
                  {value(data, "admission_year", academicYear())}
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td className="ack-d-col">
              <div className="ack-d-cell">
                <span className="ack-d-label">Program</span>
                <span className="ack-d-colon">:</span>
                <span className="ack-d-value">{value(data, "program")}</span>
              </div>
            </td>
            <td className="ack-d-col">
              <div className="ack-d-cell">
                <span className="ack-d-label">Allotted Category</span>
                <span className="ack-d-colon">:</span>
                <span className="ack-d-value">
                  {value(data, "category_allotted")}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="ack-docs-title">Documents</div>
      <table className="ack-docs">
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.label}>
              <td className="ack-check-cell">
                <span className="ack-check">{doc.submitted ? "✓" : ""}</span>
              </td>
              <td className="ack-doc-name">{doc.label}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="ack-note">
        Please retain this acknowledgement and present it, along with the
        original documents, at the time of admission.
      </p>

      <div className="ack-signatures">
        <div className="ack-sign">
          <div className="ack-sign-line" />
          <span>Student</span>
        </div>
        <div className="ack-sign">
          <div className="ack-sign-line" />
          <span>Caseworker</span>
        </div>
        <div className="ack-sign">
          <div className="ack-sign-line" />
          <span>Co-ordinator</span>
        </div>
      </div>

      <div className="ack-footer">
        <span>Date: {value(data, "date")}</span>
        <span>This is a computer generated document.</span>
      </div>
    </div>
  );
}

export function AdmissionAcknowledgement({
  data,
  documents = [],
}: {
  data: DocData;
  documents?: AckDocument[];
}) {
  return (
    <div className="ack-outer">
      <AckPage copy="OFFICE COPY" data={data} documents={documents} />
      <AckPage copy="STUDENT COPY" data={data} documents={documents} />

      <style>{`
        .ack-outer { width: 794px; margin: 0 auto; }
        .ack-page {
          width: 794px;
          height: 1135px;
          overflow: hidden;
          box-sizing: border-box;
          padding: 24px 28px;
          background: #ffffff;
          color: #1f2937;
          font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
          font-size: 12.5px;
          line-height: 1.5;
          page-break-after: always;
        }
        .ack-letterhead { display: flex; align-items: center; gap: 16px; padding-bottom: 12px; border-bottom: 3px solid #35608f; margin-bottom: 14px; position: relative; }
        .ack-logo { width: 78px; height: 78px; object-fit: contain; flex-shrink: 0; }
        .ack-college { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: .4px; color: #35608f; text-transform: uppercase; }
        .ack-tagline { margin: 2px 0 0; font-size: 10.5px; color: #5b6b7c; }
        .ack-address { margin: 2px 0 0; font-size: 10.5px; color: #5b6b7c; }
        .ack-copy-badge { position: absolute; top: 0; right: 0; border: 1.5px solid #35608f; color: #35608f; font-size: 11px; font-weight: 700; letter-spacing: 1px; padding: 3px 10px; }
        .ack-title { font-size: 15px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin: 2px 0 4px; }
        .ack-subtitle { text-align: center; color: #5b6b7c; font-size: 11.5px; margin: 0 0 12px; }
        .ack-details { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 14px; }
        .ack-details td { padding: 6px 4px; border-bottom: 1px solid #c8d3df; vertical-align: top; }
        .ack-d-col { width: 50%; }
        .ack-d-cell { display: flex; gap: 6px; align-items: baseline; }
        .ack-d-label { flex: 0 0 148px; font-weight: 600; color: #1f3a5f; }
        .ack-d-colon { flex-shrink: 0; color: #1f2937; font-weight: 600; }
        .ack-d-value { flex: 1; color: #111827; font-weight: 500; }
        .ack-docs-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1f3a5f; margin: 2px 0 6px; }
        .ack-docs { width: 100%; border-collapse: collapse; }
        .ack-docs tr { border-bottom: 1px solid #e2e8f0; }
        .ack-docs td { padding: 3.5px 6px; font-size: 12px; }
        .ack-check-cell { width: 28px; }
        .ack-check { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border: 1.5px solid #1f2937; font-size: 12px; font-weight: 700; color: #15803d; line-height: 1; }
        .ack-doc-name { color: #111827; font-weight: 500; }
        .ack-note { font-size: 11.5px; color: #5b6b7c; border: 1px dashed #b9c8d8; background: #f8fafc; padding: 8px 10px; margin: 12px 0 14px; }
        .ack-signatures { display: flex; justify-content: space-between; gap: 40px; margin: 26px 0 8px; }
        .ack-sign { flex: 1; text-align: center; }
        .ack-sign-line { border-top: 1.5px dotted #6b7c90; height: 44px; }
        .ack-sign span { font-size: 12px; font-weight: 600; color: #1f2937; }
        .ack-footer { display: flex; justify-content: space-between; border-top: 1px solid #b9c8d8; padding-top: 8px; font-size: 11px; color: #5b6b7c; }
        @media print {
          .ack-outer { width: auto; }
          .ack-page { width: auto; height: auto; page-break-after: always; }
        }
      `}</style>
    </div>
  );
}
