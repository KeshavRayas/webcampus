import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { hallTicketStyles as s } from "./styles";

export interface CourseEligibility {
  courseAssignmentId: string;
  courseCode: string;
  courseName: string;
  courseType: string;
  credits: number;
  cieTotal: number | null;
  attendancePercentage: number | null;
  isFrozen: boolean;
  markEligible: boolean;
  attendanceEligible: boolean;
  eligible: boolean;
  status: "ELIGIBLE" | "NOT_ELIGIBLE";
}

export interface StudentInfo {
  usn: string;
  name: string;
  photo: string | null;
  departmentName: string;
  currentSemester: number;
  programType: string | null;
  academicTermLabel: string;
  sectionName: string | null;
}

export interface HallTicketTemplateData {
  id: string;
  isSent: boolean;
  sentAt: string | null;
  sentBy: string | null;
  generatedAt: string;
  student: StudentInfo;
  courses: CourseEligibility[];
  qrPayload?: string;
}

function R(s: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rule of s.split(";")) {
    const t = rule.trim();
    if (!t) continue;
    const idx = t.indexOf(":");
    if (idx === -1) continue;
    result[camelCase(t.slice(0, idx).trim())] = t.slice(idx + 1).trim();
  }
  return result;
}

function camelCase(s: string): string {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div style={R(s.infoLabel)}>{label}:</div>
      <div style={R(s.infoValue)}>{value}</div>
    </>
  );
}

export function HallTicketTemplate({
  data,
  logoUrl = "/bmsce.svg",
  qrDataUrl: externalQrUrl,
}: {
  data: HallTicketTemplateData;
  logoUrl?: string;
  qrDataUrl?: string;
}) {
  const { student, courses, generatedAt, qrPayload } = data;
  const [qrUrl, setQrUrl] = useState<string>(externalQrUrl ?? "");

  useEffect(() => {
    if (externalQrUrl) {
      setQrUrl(externalQrUrl);
      return;
    }
    if (!qrPayload) {
      setQrUrl("");
      return;
    }
    QRCode.toDataURL(qrPayload, { width: 130, margin: 1 })
      .then(setQrUrl)
      .catch(() => {});
  }, [qrPayload, externalQrUrl]);

  const generatedDate = new Date(generatedAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div style={R(s.page)}>
      <div style={R(s.header)}>
        <img src={logoUrl} alt="BMSCE" style={R(s.headerLogo)} />
        <div style={R(s.headerCenter)}>
          <div style={R(s.collegeName)}>B.M.S. College of Engineering</div>
          <div style={R(s.collegeSubtitle)}>
            (Autonomous, Affiliated to VTU), Bengaluru
          </div>
          <div style={R(s.title)}>Hall Ticket</div>
          <div style={R(s.headerInfo)}>
            {student.academicTermLabel} | {student.departmentName}
          </div>
          <div style={R(s.headerInfo)}>Generated: {generatedDate}</div>
        </div>
        {qrUrl ? (
          <img src={qrUrl} alt="QR" style={R(s.headerQr)} />
        ) : (
          <div style={R(s.headerQr)} />
        )}
      </div>

      <div style={R(s.studentSection)}>
        <div style={R(s.infoGrid)}>
          <InfoRow label="USN" value={student.usn} />
          <InfoRow label="Name" value={student.name} />
          <InfoRow label="Program" value={student.programType ?? "N/A"} />
          <InfoRow label="Department" value={student.departmentName} />
          <InfoRow label="Semester" value={String(student.currentSemester)} />
          <InfoRow label="Section" value={student.sectionName ?? "N/A"} />
        </div>
        <div style={R(s.photoContainer)}>
          {student.photo ? (
            <img src={student.photo} alt="Student" style={R(s.photo)} />
          ) : (
            <div style={R(s.photoPlaceholder)}>Photo</div>
          )}
        </div>
      </div>

      <table style={R(s.table)}>
        <thead>
          <tr>
            <th style={R(s.th)}>Sl No.</th>
            <th style={R(s.th)}>Course Code</th>
            <th style={R(s.th)}>Course Title</th>
            <th style={R(s.th)}>Eligibility</th>
            <th style={R(s.th)}>Invigilator Sign</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c, i) => (
            <tr key={c.courseAssignmentId}>
              <td style={R(s.td)}>{i + 1}</td>
              <td style={R(s.td)}>{c.courseCode}</td>
              <td style={R(s.tdLeft)}>{c.courseName}</td>
              <td style={R(s.td)}>
                <span
                  style={{
                    ...R(s.td),
                    ...R(c.eligible ? s.badgeEligible : s.badgeNotEligible),
                    border: "none",
                    padding: 0,
                  }}
                >
                  {c.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}
                </span>
              </td>
              <td style={R(s.td)} />
            </tr>
          ))}
        </tbody>
      </table>

      <div style={R(s.signatureSection)}>
        <div style={R(s.signatureBlock)}>
          <div style={{ height: 40 }} />
          <div
            style={{
              width: 160,
              borderTop: "1px solid #000",
              margin: "0 auto",
            }}
          />
          <div style={R(s.signatureLabel)}>Candidate Signature</div>
        </div>
        <div style={R(s.sealContainer)}>
          <div style={R(s.sealPlaceholder)}>Official Seal</div>
        </div>
        <div style={R(s.signatureBlock)}>
          <div style={{ height: 40 }} />
          <div
            style={{
              width: 160,
              borderTop: "1px solid #000",
              margin: "0 auto",
            }}
          />
          <div style={R(s.signatureLabel)}>Controller of Examination</div>
        </div>
      </div>

      <div style={R(s.instructionsSection)}>
        <div style={R(s.instructionsTitle)}>INSTRUCTIONS TO THE CANDIDATES</div>
        <div style={R(s.instructionItem)}>
          1. Check the examination hall ticket carefully. Ensure the eligibility
          of your exams.
        </div>
        <div style={R(s.instructionItem)}>
          2. Follow the instructions printed on the facing sheet of your answer
          booklet and hall ticket.
        </div>
        <div style={R(s.instructionItem)}>
          3. Bring your Student ID Card and Hall ticket during the examination.
          You will not be allowed to enter the examination hall without these.
        </div>
        <div style={R(s.instructionItem)}>
          4. Do not bring any unauthorized material like electronic gadgets,
          Mobile Phones, written materials, or any sort of materials that may
          lead to malpractice, the same will be checked, confiscated, and will
          be booked under malpractice.
        </div>
        <div style={R(s.instructionItem)}>
          5. Arrive at least 15 minutes before the start of the examination. As
          you enter, show your Student ID card.
        </div>
        <div style={R(s.instructionItem)}>
          6. Listen carefully to instructions. Students are required to comply
          with the instructions of invigilators at all times.
        </div>
        <div style={R(s.instructionItem)}>
          7. You will NOT be allowed to enter the examination center 30 minutes
          after the start of the EXAMINATION.
        </div>
      </div>

      <div style={R(s.footer)}>
        This is a computer-generated hall ticket. No signature required.
      </div>
    </div>
  );
}
