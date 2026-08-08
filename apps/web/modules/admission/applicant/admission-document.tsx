"use client";

import React from "react";

export type DocData = Record<string, string>;

export const COLLEGE = {
  name: "BMS COLLEGE OF ENGINEERING",
  tagline: "Affiliated to VTU · Approved by AICTE · Accredited by NBA",
  address: "P.O. Box No. 1908, Bull Temple Road",
  city: "Basavanagudi",
  state: "Bengaluru",
  pincode: "560019",
};

const value = (data: DocData, key: string) => {
  const raw = data[key]?.trim();
  return raw ? raw : "—";
};

function Row({
  label,
  data,
  keyName,
  span = false,
}: {
  label: string;
  data: DocData;
  keyName: string;
  span?: boolean;
}) {
  return (
    <div className={span ? "doc-row doc-span" : "doc-row"}>
      <span className="doc-label">{label}</span>
      <span className="doc-value">{value(data, keyName)}</span>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="doc-panel">
      {title && <div className="doc-group-head">{title}</div>}
      {children}
    </div>
  );
}

const pct = (data: DocData, mk: string, mkMax: string) => {
  const got = data[mk];
  const max = data[mkMax];
  if (!got || !max) return "—";
  const n = Number(got);
  const t = Number(max);
  if (!Number.isFinite(n) || !Number.isFinite(t) || t <= 0) return "—";
  return `${((n / t) * 100).toFixed(2)}%`;
};

export function AdmissionDocument({ data }: { data: DocData }) {
  return (
    <div className="doc-page">
      {/* Letterhead */}
      <div className="doc-letterhead">
        <img
          src="/logo.svg"
          alt="College Logo"
          className="doc-logo"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        <div className="doc-institute">
          <p className="doc-college">{COLLEGE.name}</p>
          <p className="doc-tagline">{COLLEGE.tagline}</p>
          <p className="doc-address">
            {COLLEGE.address}, {COLLEGE.city}, {COLLEGE.state} —{" "}
            {COLLEGE.pincode}
          </p>
        </div>
      </div>

      <div className="doc-title">Admission Form</div>

      {/* Personal Information */}
      <section>
        <Panel title="Personal Information">
          <div className="doc-personal-grid">
            <span className="doc-lbl">Full Name (as per marks card)</span>
            <span className="doc-val">{value(data, "student_name")}</span>
            <span className="doc-lbl">Date of Birth</span>
            <span className="doc-val">{value(data, "dob")}</span>
            <span className="doc-lbl">Blood Group</span>
            <span className="doc-val">{value(data, "blood_group")}</span>
            <span className="doc-lbl">Gender</span>
            <span className="doc-val">{value(data, "gender")}</span>
            <div className="doc-photo-cell">
              {data.photo ? (
                <img src={data.photo} alt="Student Photo" />
              ) : (
                <span>Photo</span>
              )}
            </div>
          </div>
          <Row label="Primary Mobile" data={data} keyName="primary_phone" />
          <Row label="Secondary Mobile" data={data} keyName="secondary_phone" />
          <Row
            label="Emergency Contact"
            data={data}
            keyName="emergency_phone"
          />
          <Row label="Primary Email" data={data} keyName="primary_email" />
          <Row label="Secondary Email" data={data} keyName="secondary_email" />
          <div className="doc-row doc-highlight doc-span">
            <span className="doc-label">Current Address</span>
            <span className="doc-value">
              {value(data, "current_address")}, {value(data, "current_area")},{" "}
              {value(data, "current_district")}, {value(data, "current_state")},{" "}
              {value(data, "current_country")} —{" "}
              {value(data, "current_pincode")}
            </span>
          </div>
          <div className="doc-row doc-highlight doc-span">
            <span className="doc-label">Permanent Address</span>
            <span className="doc-value">
              {value(data, "permanent_address")},{" "}
              {value(data, "permanent_area")},{" "}
              {value(data, "permanent_district")},{" "}
              {value(data, "permanent_state")},{" "}
              {value(data, "permanent_country")} —{" "}
              {value(data, "permanent_pincode")}
            </span>
          </div>
          <Row label="Place of Birth" data={data} keyName="place_of_birth" />
          <Row label="Domicile State" data={data} keyName="domicile_state" />
          <Row label="Religion" data={data} keyName="religion" />
          <Row label="Caste" data={data} keyName="caste" />
          <Row label="Sub Caste" data={data} keyName="sub_caste" />
          <Row label="Mother Tongue" data={data} keyName="mother_tongue" />
          <Row label="Nationality" data={data} keyName="nationality" />
          <Row label="Aadhaar Number" data={data} keyName="aadhar_number" />
          <Row label="NRI Status" data={data} keyName="nri" />
          <Row label="Disability" data={data} keyName="disability" />
          <Row
            label="Disability Details"
            data={data}
            keyName="disability_type"
          />
          <Row
            label="Economically Backward"
            data={data}
            keyName="economically_backward"
          />
          <Row
            label="Student Passport No."
            data={data}
            keyName="passport_number"
          />
          <Row
            label="Passport Expiry Date"
            data={data}
            keyName="passport_expiry"
          />
          <Row label="Student Visa No." data={data} keyName="visa_number" />
          <Row label="Visa Expiry Date" data={data} keyName="visa_expiry" />
        </Panel>
      </section>

      {/* Admission Details */}
      <section>
        <Panel title="Admission Details">
          <Row label="Application ID" data={data} keyName="application_id" />
          <Row
            label="Mode of Admission"
            data={data}
            keyName="mode_of_admission"
          />
          <Row label="Branch / Department" data={data} keyName="branch" />
          <Row label="Admission Type" data={data} keyName="admission_type" />
          <Row
            label="Admission Based On"
            data={data}
            keyName="admission_based_on"
          />
          <Row label="Semester / Term" data={data} keyName="semester" />
          <Row
            label="Category Claimed"
            data={data}
            keyName="category_claimed"
          />
          <Row
            label="Category Allotted"
            data={data}
            keyName="category_allotted"
          />
          <Row label="Quota" data={data} keyName="quota" />
          <Row
            label="Entrance Exam Rank"
            data={data}
            keyName="entrance_exam_rank"
          />
          <Row label="Sports / Discipline" data={data} keyName="sport_name" />
          <Row
            label="Admission Order No."
            data={data}
            keyName="admission_order_number"
          />
          <Row
            label="Admission Order Date"
            data={data}
            keyName="admission_order_date"
          />
          <Row
            label="Counselling Round"
            data={data}
            keyName="counselling_round"
          />
          <Row label="ABC / APAAR ID" data={data} keyName="abc_apar_id" />
          <Row label="Hostel" data={data} keyName="hostel" />
        </Panel>
      </section>

      {/* Education Details */}
      <section>
        <Panel title="Class X">
          <Row label="School Name" data={data} keyName="class10_school_name" />
          <Row
            label="Roll / Reg. Number"
            data={data}
            keyName="class10_reg_number"
          />
          <Row label="School Type" data={data} keyName="class10_school_type" />
          <Row label="School Country" data={data} keyName="class10_country" />
          <Row label="School State" data={data} keyName="class10_state" />
          <Row label="School City" data={data} keyName="class10_city" />
          <Row label="Year of Passing" data={data} keyName="class10_year" />
          <Row label="Marks Obtained" data={data} keyName="class10_marks" />
          <Row label="Total Marks" data={data} keyName="class10_total" />
          <Row
            label="Medium of Instruction"
            data={data}
            keyName="class10_medium"
          />
          <Row label="Studied Kannada" data={data} keyName="class10_kannada" />
        </Panel>

        <Panel title="Class XII / PUC">
          <Row
            label="Institute Name"
            data={data}
            keyName="class12_institute_name"
          />
          <Row
            label="Institute Type"
            data={data}
            keyName="class12_institute_type"
          />
          <Row
            label="Institute Country"
            data={data}
            keyName="class12_country"
          />
          <Row label="Institute State" data={data} keyName="class12_state" />
          <Row label="Institute City" data={data} keyName="class12_city" />
          <Row label="Branch" data={data} keyName="class12_branch" />
          <Row
            label="Roll / Reg. Number"
            data={data}
            keyName="class12_reg_number"
          />
          <Row label="Year of Passing" data={data} keyName="class12_year" />
          <Row
            label="Medium of Instruction"
            data={data}
            keyName="class12_medium"
          />
          <Row label="Marks Obtained" data={data} keyName="class12_marks" />
          <Row label="Total Marks" data={data} keyName="class12_total" />

          <table className="doc-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Marks Obtained</th>
                <th>Max Marks</th>
                <th>Min / Pass</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Physics</td>
                <td>{value(data, "physics_marks")}</td>
                <td>{value(data, "physics_max")}</td>
                <td>{value(data, "physics_min")}</td>
                <td>{pct(data, "physics_marks", "physics_max")}</td>
              </tr>
              <tr>
                <td>Chemistry</td>
                <td>{value(data, "chemistry_marks")}</td>
                <td>{value(data, "chemistry_max")}</td>
                <td>{value(data, "chemistry_min")}</td>
                <td>{pct(data, "chemistry_marks", "chemistry_max")}</td>
              </tr>
              <tr>
                <td>Mathematics</td>
                <td>{value(data, "maths_marks")}</td>
                <td>{value(data, "maths_max")}</td>
                <td>{value(data, "maths_min")}</td>
                <td>{pct(data, "maths_marks", "maths_max")}</td>
              </tr>
            </tbody>
          </table>

          <div className="doc-pcm">
            PCM Aggregate Percentage:{" "}
            <strong>{value(data, "pcm_percentage")}%</strong>
          </div>
        </Panel>

        <Panel title="Diploma">
          <Row
            label="Institute Name"
            data={data}
            keyName="diploma_institute_name"
          />
          <Row
            label="Institute Type"
            data={data}
            keyName="diploma_institute_type"
          />
          <Row
            label="Institute Country"
            data={data}
            keyName="diploma_country"
          />
          <Row label="Institute State" data={data} keyName="diploma_state" />
          <Row label="Institute City" data={data} keyName="diploma_city" />
          <Row label="Branch" data={data} keyName="diploma_branch" />
          <Row label="Year of Passing" data={data} keyName="diploma_year" />
          <Row
            label="Medium of Instruction"
            data={data}
            keyName="diploma_medium"
          />
          <Row label="Marks Obtained" data={data} keyName="diploma_marks" />
          <Row label="Total Marks" data={data} keyName="diploma_total" />
        </Panel>
      </section>

      {/* Parent Details */}
      <section>
        <div className="doc-pair">
          <Panel title="Father">
            <Row label="Full Name" data={data} keyName="father_name" />
            <Row label="Occupation" data={data} keyName="father_occupation" />
            <Row label="Annual Income" data={data} keyName="father_income" />
            <Row label="Mobile No." data={data} keyName="father_mobile" />
            <Row label="Email ID" data={data} keyName="father_email" />
            <Row label="Address" data={data} keyName="father_address" />
            <Row label="Passport No." keyName="parent_passport" data={data} />
            <Row label="Visa No." keyName="parent_visa" data={data} />
            <Row label="Visa Expiry" keyName="parent_visa_expiry" data={data} />
          </Panel>
          <Panel title="Mother">
            <Row label="Full Name" data={data} keyName="mother_name" />
            <Row label="Occupation" data={data} keyName="mother_occupation" />
            <Row label="Annual Income" data={data} keyName="mother_income" />
            <Row label="Mobile No." data={data} keyName="mother_mobile" />
            <Row label="Email ID" data={data} keyName="mother_email" />
            <Row label="Address" data={data} keyName="mother_address" />
          </Panel>
        </div>

        <Panel title="Guardian">
          <Row label="Full Name" data={data} keyName="guardian_name" />
          <Row label="Occupation" data={data} keyName="guardian_occupation" />
          <Row label="Annual Income" data={data} keyName="guardian_income" />
          <Row label="Mobile No." data={data} keyName="guardian_mobile" />
          <Row label="Email ID" data={data} keyName="guardian_email" />
          <Row label="Address" data={data} keyName="guardian_address" />
        </Panel>
      </section>

      <div className="doc-footer">
        <span>Applicant Signature</span>
        <span>{value(data, "signature")}</span>
        <span>{value(data, "date")}</span>
      </div>

      <style>{`
        .doc-page {
          width: 794px;
          background: #ffffff;
          color: #1f2937;
          font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          border-radius: 0;
          margin: 0 auto;
        }
        .doc-letterhead {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-bottom: 14px;
          border-bottom: 3px solid #35608f;
          margin-bottom: 16px;
        }
        .doc-logo { width: 88px; height: 88px; object-fit: contain; flex-shrink: 0; }
        .doc-personal-grid { display: grid; grid-template-columns: 42% 1fr 98px; border-bottom: 1px solid #dbe3ec; }
        .doc-personal-grid .doc-lbl { padding: 5px 12px; border-right: 1px solid #dbe3ec; color: #5b6b7c; font-weight: 500; display: flex; align-items: center; }
        .doc-personal-grid .doc-val { padding: 5px 12px; color: #111827; font-weight: 500; border-right: 1px solid #dbe3ec; }
        .doc-photo-cell { grid-column: 3; grid-row: 1 / span 4; border-left: 1px solid #dbe3ec; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px 4px; }
        .doc-photo-cell img { width: 74px; height: 88px; object-fit: cover; }
        .doc-photo-cell span { color: #9aa7b5; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
        .doc-college { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: .4px; color: #35608f; text-transform: uppercase; }
        .doc-tagline { margin: 2px 0 0; font-size: 11px; color: #5b6b7c; }
        .doc-address { margin: 2px 0 0; font-size: 11px; color: #5b6b7c; }
        .doc-title { font-size: 15px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin: 8px 0 14px; }
        .doc-panel { border: 1px solid #b9c8d8; background: #fff; margin-bottom: 14px; border-radius: 0; }
        .doc-group-head {
          background: #eef5fd; color: #1f3a5f; font-weight: 700; font-size: 12px;
          text-transform: uppercase; letter-spacing: .5px; padding: 6px 12px; border-bottom: 1px solid #b9c8d8; border-radius: 0;
        }
        .doc-row { display: flex; }
        .doc-row:nth-child(even):not(.doc-highlight) { background: #f8fafc; }
        .doc-label { flex: 0 0 42%; padding: 5px 12px; border-right: 1px solid #dbe3ec; color: #5b6b7c; font-weight: 500; }
        .doc-value { flex: 1; padding: 5px 12px; color: #111827; font-weight: 500; }
        .doc-highlight { background: #f0f7ff !important; }
        .doc-highlight .doc-label, .doc-highlight .doc-value { font-weight: 600; }
        .doc-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
        .doc-table th, .doc-table td { border: 1px solid #b9c8d8; padding: 5px 8px; text-align: left; font-size: 11px; }
        .doc-table thead th { background: #eef5fd; color: #35608f; font-weight: 700; }
        .doc-pcm { padding: 6px 12px; background: #f0f7ff; border-top: 1px solid #b9c8d8; color: #1f2937; }
        .doc-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
        .doc-footer { display: flex; justify-content: space-between; gap: 24px; margin-top: 18px; padding-top: 10px; border-top: 1px solid #b9c8d8; font-size: 11px; color: #5b6b7c; }
        @media print {
          .doc-page { width: auto; }
          section { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
