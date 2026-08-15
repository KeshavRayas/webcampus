"use client";

import React from "react";
import { COLLEGE, type DocData } from "./admission-document";

const value = (data: DocData, key: string) => {
  const raw = data[key]?.trim();
  return raw ? raw : "—";
};

function AckRow({
  label,
  data,
  keyName,
}: {
  label: string;
  data: DocData;
  keyName: string;
}) {
  return (
    <tr>
      <td className="ack-label">{label}</td>
      <td className="ack-value">{value(data, keyName)}</td>
    </tr>
  );
}

export function AdmissionAcknowledgement({ data }: { data: DocData }) {
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
      </div>

      <div className="ack-title">Acknowledgement of Application</div>
      <p className="ack-subtitle">
        This is to acknowledge the receipt of your application for admission.
      </p>

      <table className="ack-table">
        <tbody>
          <AckRow label="Application ID" data={data} keyName="application_id" />
          <AckRow label="Applicant Name" data={data} keyName="student_name" />
          <AckRow label="Date of Birth" data={data} keyName="dob" />
          <AckRow label="Gender" data={data} keyName="gender" />
          <AckRow label="Primary Email" data={data} keyName="primary_email" />
          <AckRow label="Primary Mobile" data={data} keyName="primary_phone" />
          <AckRow
            label="Mode of Admission"
            data={data}
            keyName="mode_of_admission"
          />
          <AckRow label="Branch / Department" data={data} keyName="branch" />
          <AckRow label="Admission Type" data={data} keyName="admission_type" />
          <AckRow label="Semester / Term" data={data} keyName="semester" />
          <AckRow
            label="Category Claimed"
            data={data}
            keyName="category_claimed"
          />
          <AckRow
            label="Category Allotted"
            data={data}
            keyName="category_allotted"
          />
          <AckRow label="Quota" data={data} keyName="quota" />
          <AckRow
            label="Admission Based On"
            data={data}
            keyName="admission_based_on"
          />
          <AckRow label="Nationality" data={data} keyName="nationality" />
        </tbody>
      </table>

      <p className="ack-note">
        Please retain this acknowledgement and present it, along with the
        original documents, at the time of admission.
      </p>

      <div className="ack-footer">
        <span>Signature of Authorized Officer</span>
        <span>Date: {value(data, "date")}</span>
      </div>

      <style>{`
        .ack-page {
          width: 794px;
          background: #ffffff;
          color: #1f2937;
          font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
          font-size: 13px;
          line-height: 1.6;
          margin: 0 auto;
        }
        .ack-letterhead {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-bottom: 14px;
          border-bottom: 3px solid #35608f;
          margin-bottom: 18px;
        }
        .ack-logo { width: 84px; height: 84px; object-fit: contain; flex-shrink: 0; }
        .ack-college { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: .4px; color: #35608f; text-transform: uppercase; }
        .ack-tagline { margin: 2px 0 0; font-size: 11px; color: #5b6b7c; }
        .ack-address { margin: 2px 0 0; font-size: 11px; color: #5b6b7c; }
        .ack-title { font-size: 16px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 6px; }
        .ack-subtitle { text-align: center; color: #5b6b7c; font-size: 12px; margin: 0 0 18px; }
        .ack-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        .ack-table td { border: 1px solid #b9c8d8; padding: 7px 12px; }
        .ack-label { width: 38%; background: #eef5fd; color: #1f3a5f; font-weight: 600; }
        .ack-value { color: #111827; font-weight: 500; }
        .ack-note { font-size: 12px; color: #5b6b7c; border: 1px dashed #b9c8d8; background: #f8fafc; padding: 10px 12px; margin-bottom: 20px; }
        .ack-footer { display: flex; justify-content: space-between; border-top: 1px solid #b9c8d8; padding-top: 10px; font-size: 12px; color: #5b6b7c; }
        @media print {
          .ack-page { width: auto; }
        }
      `}</style>
    </div>
  );
}
