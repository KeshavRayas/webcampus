"use client";

import React from "react";
import { COLLEGE } from "../applicant/admission-document";

export type FeeRecordRow = {
  applicationId: string;
  name: string;
  email: string;
  feePaid: string;
  receiptNo: string;
  status: string;
  mode: string;
};

export type FeeReportData = {
  generatedAt: string;
  total: number;
  paid: number;
  unpaid: number;
  approved: number;
  pending: number;
  rows: FeeRecordRow[];
};

export type FeeReceiptData = {
  receiptNo: string;
  receiptDate: string;
  name: string;
  applicationId: string;
  usn: string;
  contact: string;
  branch: string;
  quota: string;
  paymentMode: string;
  transactionId: string;
  transactionDate: string;
  totalAmountText: string;
  amountInWords: string;
};

function FDLetterhead() {
  return (
    <div className="fd-letterhead">
      <img
        src="/logo.svg"
        alt="College Logo"
        className="fd-logo"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
      <div>
        <p className="fd-college">{COLLEGE.name}</p>
        <p className="fd-tagline">{COLLEGE.tagline}</p>
        <p className="fd-address">
          {COLLEGE.address}, {COLLEGE.city}, {COLLEGE.state} — {COLLEGE.pincode}
        </p>
      </div>
    </div>
  );
}

function FDTitle({ children }: { children: React.ReactNode }) {
  return <div className="fd-title">{children}</div>;
}

function FDPanel({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fd-panel">
      {title && <div className="fd-group-head">{title}</div>}
      {children}
    </div>
  );
}

function FDRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="fd-row">
      <span className="fd-label">{label}</span>
      <span className="fd-value">{value || "—"}</span>
    </div>
  );
}

const shrink = (value: string) => (value?.trim() ? value.trim() : "—");

export function FeeReportDocument({ data }: { data: FeeReportData }) {
  return (
    <div className="fd-page">
      <FDLetterhead />
      <FDTitle>Admission Fee Payment Report</FDTitle>

      <div className="fd-meta">
        <span>Generated on: {data.generatedAt}</span>
        <span>
          Total: {data.total} · Paid: {data.paid} · Unpaid: {data.unpaid} ·
          Approved: {data.approved} · Pending Review: {data.pending}
        </span>
      </div>

      <FDPanel title="Payment Summary">
        <table className="fd-table">
          <thead>
            <tr>
              <th>Application ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Fee Paid (₹)</th>
              <th>Receipt No.</th>
              <th>Status</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, index) => (
              <tr key={`${row.applicationId}-${index}`}>
                <td>{shrink(row.applicationId)}</td>
                <td>{shrink(row.name)}</td>
                <td>{shrink(row.email)}</td>
                <td>{shrink(row.feePaid)}</td>
                <td>{shrink(row.receiptNo)}</td>
                <td>{shrink(row.status)}</td>
                <td>{shrink(row.mode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </FDPanel>

      <div className="fd-footer">
        <span>This is a system generated report</span>
      </div>

      <style>{`
        .fd-page {
          width: 794px;
          background: #ffffff;
          color: #1f2937;
          font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          margin: 0 auto;
        }
        .fd-letterhead {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-bottom: 14px;
          border-bottom: 3px solid #35608f;
          margin-bottom: 14px;
        }
        .fd-logo { width: 88px; height: 88px; object-fit: contain; flex-shrink: 0; }
        .fd-college { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: .4px; color: #35608f; text-transform: uppercase; }
        .fd-tagline { margin: 2px 0 0; font-size: 11px; color: #5b6b7c; }
        .fd-address { margin: 2px 0 0; font-size: 11px; color: #5b6b7c; }
        .fd-title { font-size: 15px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin: 6px 0 12px; color: #1f3a5f; }
        .fd-meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; font-size: 11px; color: #5b6b7c; margin-bottom: 10px; }
        .fd-panel { border: 1px solid #b9c8d8; background: #fff; margin-bottom: 14px; }
        .fd-group-head {
          background: #eef5fd; color: #1f3a5f; font-weight: 700; font-size: 12px;
          text-transform: uppercase; letter-spacing: .5px; padding: 6px 12px; border-bottom: 1px solid #b9c8d8;
        }
        .fd-row { display: flex; }
        .fd-row:nth-child(even) { background: #f8fafc; }
        .fd-label { flex: 0 0 40%; padding: 5px 12px; border-right: 1px solid #dbe3ec; color: #5b6b7c; font-weight: 500; }
        .fd-value { flex: 1; padding: 5px 12px; color: #111827; font-weight: 500; }
        .fd-table { width: 100%; border-collapse: collapse; }
        .fd-table th, .fd-table td { border: 1px solid #b9c8d8; padding: 5px 8px; text-align: left; font-size: 11px; }
        .fd-table thead th { background: #eef5fd; color: #35608f; font-weight: 700; }
        .fd-table tbody tr:nth-child(even) { background: #f8fafc; }
        .fd-footer { display: flex; justify-content: space-between; gap: 24px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #b9c8d8; font-size: 11px; color: #5b6b7c; }
        .fd-total-box {
          border: 1px solid #b9c8d8; background: #f0f7ff; padding: 10px 14px; margin: 6px 0;
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
        }
        .fd-total-label { font-weight: 700; color: #1f3a5f; }
        .fd-total-value { font-weight: 700; font-size: 14px; color: #35608f; }
        .fd-words { font-size: 11px; color: #111827; margin: 2px 0 0; }
        .fd-sig { margin-top: 40px; display: flex; justify-content: flex-end; }
        .fd-sig div { border-top: 1px solid #5b6b7c; padding-top: 4px; font-size: 11px; color: #5b6b7c; text-align: center; width: 220px; }
      `}</style>
    </div>
  );
}

export function FeeReceiptDocument({ data }: { data: FeeReceiptData }) {
  return (
    <div className="fd-page">
      <FDLetterhead />
      <FDTitle>Admission Fee Payment Receipt</FDTitle>

      <FDPanel>
        <FDRow label="Receipt No." value={data.receiptNo} />
        <FDRow label="Receipt Date" value={data.receiptDate} />
      </FDPanel>

      <FDPanel title="Student Details">
        <FDRow label="Student Name" value={data.name} />
        <FDRow label="Application No." value={data.applicationId} />
        <FDRow label="USN / Reg. No." value={data.usn} />
        <FDRow label="Contact No." value={data.contact} />
        <FDRow label="Branch" value={data.branch} />
        <FDRow label="Admission Quota" value={data.quota} />
      </FDPanel>

      <FDPanel title="Payment Details">
        <FDRow label="Payment Mode" value={data.paymentMode} />
        <FDRow label="Transaction No." value={data.transactionId} />
        <FDRow label="Transaction Date" value={data.transactionDate} />
      </FDPanel>

      <FDPanel title="Fee Breakdown">
        <table className="fd-table">
          <thead>
            <tr>
              <th>Particulars</th>
              <th>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Admission &amp; Tuition Fee</td>
              <td>{data.totalAmountText}</td>
            </tr>
            <tr>
              <td>Miscellaneous Fees</td>
              <td>—</td>
            </tr>
            <tr>
              <td>Exam Fee</td>
              <td>—</td>
            </tr>
            <tr>
              <td>VTU / University Fees</td>
              <td>—</td>
            </tr>
            <tr>
              <td>Skill Lab Fee</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </FDPanel>

      <div className="fd-total-box">
        <div>
          <div className="fd-total-label">Total Amount (₹)</div>
          <div className="fd-words">Amount in words : {data.amountInWords}</div>
        </div>
        <div className="fd-total-value">₹ {data.totalAmountText}</div>
      </div>

      <div className="fd-sig">
        <div>Authorised Signature</div>
      </div>

      <div className="fd-footer">
        <span>This is a system generated receipt</span>
      </div>

      <style>{`
        .fd-page {
          width: 794px;
          background: #ffffff;
          color: #1f2937;
          font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          margin: 0 auto;
        }
        .fd-letterhead {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-bottom: 14px;
          border-bottom: 3px solid #35608f;
          margin-bottom: 14px;
        }
        .fd-logo { width: 88px; height: 88px; object-fit: contain; flex-shrink: 0; }
        .fd-college { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: .4px; color: #35608f; text-transform: uppercase; }
        .fd-tagline { margin: 2px 0 0; font-size: 11px; color: #5b6b7c; }
        .fd-address { margin: 2px 0 0; font-size: 11px; color: #5b6b7c; }
        .fd-title { font-size: 15px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin: 6px 0 12px; color: #1f3a5f; }
        .fd-panel { border: 1px solid #b9c8d8; background: #fff; margin-bottom: 14px; }
        .fd-group-head {
          background: #eef5fd; color: #1f3a5f; font-weight: 700; font-size: 12px;
          text-transform: uppercase; letter-spacing: .5px; padding: 6px 12px; border-bottom: 1px solid #b9c8d8;
        }
        .fd-row { display: flex; }
        .fd-row:nth-child(even) { background: #f8fafc; }
        .fd-label { flex: 0 0 40%; padding: 5px 12px; border-right: 1px solid #dbe3ec; color: #5b6b7c; font-weight: 500; }
        .fd-value { flex: 1; padding: 5px 12px; color: #111827; font-weight: 500; }
        .fd-table { width: 100%; border-collapse: collapse; }
        .fd-table th, .fd-table td { border: 1px solid #b9c8d8; padding: 5px 8px; text-align: left; font-size: 11px; }
        .fd-table thead th { background: #eef5fd; color: #35608f; font-weight: 700; }
        .fd-total-box {
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          border: 1px solid #b9c8d8; background: #f0f7ff; padding: 10px 14px; margin: 6px 0;
        }
        .fd-total-label { font-weight: 700; color: #1f3a5f; }
        .fd-total-value { font-weight: 700; font-size: 14px; color: #35608f; }
        .fd-words { font-size: 11px; color: #111827; margin: 2px 0 0; }
        .fd-sig { margin-top: 40px; display: flex; justify-content: flex-end; }
        .fd-sig div { border-top: 1px solid #5b6b7c; padding-top: 4px; font-size: 11px; color: #5b6b7c; text-align: center; width: 220px; }
        .fd-footer { display: flex; justify-content: space-between; gap: 24px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #b9c8d8; font-size: 11px; color: #5b6b7c; }
      `}</style>
    </div>
  );
}
