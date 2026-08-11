import { COLLEGE } from "../applicant/admission-document";

export type UploadDocsReportRow = {
  applicationId: string;
  name: string;
  email: string;
  status: string;
  uploaded: number;
  total: number;
};

export type UploadDocsReportData = {
  generatedAt: string;
  total: number;
  complete: number;
  incomplete: number;
  rows: UploadDocsReportRow[];
};

export function UploadDocsReportDocument({
  data,
}: {
  data: UploadDocsReportData;
}) {
  return (
    <div className="ur-page">
      <div className="ar-letterhead">
        <img
          src="/logo.svg"
          alt="College Logo"
          className="ar-logo"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        <div>
          <p className="ar-college">{COLLEGE.name}</p>
          <p className="ar-tagline">{COLLEGE.tagline}</p>
          <p className="ar-address">
            {COLLEGE.address}, {COLLEGE.city}, {COLLEGE.state} —{" "}
            {COLLEGE.pincode}
          </p>
        </div>
      </div>

      <div className="ar-title">Upload Documents Report</div>

      <div className="ar-meta">
        <span>Generated on: {data.generatedAt}</span>
        <span>
          Total: {data.total} · Complete: {data.complete} · Incomplete:{" "}
          {data.incomplete}
        </span>
      </div>

      <div className="ar-panel">
        <div className="ar-group-head">Student Details</div>
        <div className="overflow-hidden">
          <table className="ar-table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Documents</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={`${row.applicationId}-${index}`}>
                  <td>{row.applicationId || "—"}</td>
                  <td>{row.name || "—"}</td>
                  <td>{row.email || "—"}</td>
                  <td>{row.status || "—"}</td>
                  <td>
                    {row.uploaded}/{row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ar-footer">This is a system generated report</div>

      <style>{`
        .ur-page {
          width: 794px;
          background: #ffffff;
          color: #1f2937;
          font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          margin: 0 auto;
        }
        .ar-letterhead {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-bottom: 14px;
          border-bottom: 3px solid #35608f;
          margin-bottom: 14px;
        }
        .ar-logo { width: 88px; height: 88px; object-fit: contain; flex-shrink: 0; }
        .ar-college { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: .4px; color: #35608f; text-transform: uppercase; }
        .ar-tagline { margin: 2px 0 0; font-size: 11px; color: #5b6b7c; }
        .ar-address { margin: 2px 0 0; font-size: 11px; color: #5b6b7c; }
        .ar-title { font-size: 15px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin: 6px 0 12px; color: #1f3a5f; }
        .ar-meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; font-size: 11px; color: #5b6b7c; margin-bottom: 10px; }
        .ar-panel { border: 1px solid #b9c8d8; background: #fff; margin-bottom: 14px; }
        .ar-group-head {
          background: #eef5fd; color: #1f3a5f; font-weight: 700; font-size: 12px;
          text-transform: uppercase; letter-spacing: .5px; padding: 6px 12px; border-bottom: 1px solid #b9c8d8;
        }
        .ar-table { width: 100%; border-collapse: collapse; }
        .ar-table th, .ar-table td { border: 1px solid #b9c8d8; padding: 5px 7px; text-align: left; font-size: 10.5px; }
        .ar-table thead th { background: #eef5fd; color: #35608f; font-weight: 700; }
        .ar-table tbody tr:nth-child(even) { background: #f8fafc; }
        .ar-footer { display: flex; justify-content: space-between; gap: 24px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #b9c8d8; font-size: 11px; color: #5b6b7c; }
      `}</style>
    </div>
  );
}
