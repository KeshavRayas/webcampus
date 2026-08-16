"use client";

import { Copy, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-toastify";

type TabType =
  | "fee_structure"
  | "search_student"
  | "reports"
  | "add_tuition_fee";

interface MandatoryFeeItem {
  slNo: number;
  feeHead: string;
  actualDemand: number;
  concession: number;
  currentDemand: number;
  paidSoFar: number;
  payingNow: number;
}

const MANDATORY_FEE_ITEMS: MandatoryFeeItem[] = [
  {
    slNo: 1,
    feeHead: "STUDENT FEEDBACK FEES",
    actualDemand: 250,
    concession: 0,
    currentDemand: 250,
    paidSoFar: 250,
    payingNow: 0,
  },
  {
    slNo: 2,
    feeHead: "SPORTS AND GAMES",
    actualDemand: 50,
    concession: 0,
    currentDemand: 50,
    paidSoFar: 50,
    payingNow: 0,
  },
  {
    slNo: 3,
    feeHead: "ASSOCIATION FEE",
    actualDemand: 50,
    concession: 0,
    currentDemand: 50,
    paidSoFar: 50,
    payingNow: 0,
  },
  {
    slNo: 4,
    feeHead: "READING ROOM FEE LIBRARY",
    actualDemand: 75,
    concession: 0,
    currentDemand: 75,
    paidSoFar: 75,
    payingNow: 0,
  },
  {
    slNo: 5,
    feeHead: "MEDICAL EXAM FEE",
    actualDemand: 20,
    concession: 0,
    currentDemand: 20,
    paidSoFar: 20,
    payingNow: 0,
  },
  {
    slNo: 6,
    feeHead: "MAGAZINE FEE",
    actualDemand: 25,
    concession: 0,
    currentDemand: 25,
    paidSoFar: 25,
    payingNow: 0,
  },
  {
    slNo: 7,
    feeHead: "HAND BOOK",
    actualDemand: 50,
    concession: 0,
    currentDemand: 50,
    paidSoFar: 50,
    payingNow: 0,
  },
  {
    slNo: 8,
    feeHead: "REGISTRATION FEE",
    actualDemand: 100,
    concession: 0,
    currentDemand: 100,
    paidSoFar: 100,
    payingNow: 0,
  },
  {
    slNo: 9,
    feeHead: "STUDENT TEACHER WELFARE FUND",
    actualDemand: 500,
    concession: 0,
    currentDemand: 500,
    paidSoFar: 500,
    payingNow: 0,
  },
  {
    slNo: 10,
    feeHead: "FLAG FEE",
    actualDemand: 75,
    concession: 0,
    currentDemand: 75,
    paidSoFar: 75,
    payingNow: 0,
  },
  {
    slNo: 11,
    feeHead: "MEDICLAIM/ACCIDENT INSURANCE",
    actualDemand: 1138,
    concession: 0,
    currentDemand: 1138,
    paidSoFar: 1138,
    payingNow: 0,
  },
  {
    slNo: 12,
    feeHead: "DATA CENTER FEE",
    actualDemand: 2100,
    concession: 0,
    currentDemand: 2100,
    paidSoFar: 2100,
    payingNow: 0,
  },
  {
    slNo: 13,
    feeHead: "LIBRARY FEE",
    actualDemand: 1400,
    concession: 0,
    currentDemand: 1400,
    paidSoFar: 1400,
    payingNow: 0,
  },
  {
    slNo: 14,
    feeHead: "READING ROOM FEE",
    actualDemand: 25,
    concession: 0,
    currentDemand: 25,
    paidSoFar: 25,
    payingNow: 0,
  },
  {
    slNo: 15,
    feeHead: "JOURNALS FEES",
    actualDemand: 1650,
    concession: 0,
    currentDemand: 1650,
    paidSoFar: 1650,
    payingNow: 0,
  },
  {
    slNo: 16,
    feeHead: "AUTONOMOUS EXAM FEE",
    actualDemand: 3360,
    concession: 0,
    currentDemand: 3360,
    paidSoFar: 3360,
    payingNow: 0,
  },
  {
    slNo: 17,
    feeHead: "LABORATORY CHARGES",
    actualDemand: 1500,
    concession: 0,
    currentDemand: 1500,
    paidSoFar: 1500,
    payingNow: 0,
  },
  {
    slNo: 18,
    feeHead: "MAINTAINANCE FEE",
    actualDemand: 5242,
    concession: 0,
    currentDemand: 5242,
    paidSoFar: 5242,
    payingNow: 0,
  },
  {
    slNo: 19,
    feeHead: "E-GOVERNANCE",
    actualDemand: 250,
    concession: 0,
    currentDemand: 250,
    paidSoFar: 250,
    payingNow: 0,
  },
  {
    slNo: 20,
    feeHead: "INTERNET FEE",
    actualDemand: 2900,
    concession: 0,
    currentDemand: 2900,
    paidSoFar: 2900,
    payingNow: 0,
  },
  {
    slNo: 21,
    feeHead: "SPORTS FEE",
    actualDemand: 700,
    concession: 0,
    currentDemand: 700,
    paidSoFar: 700,
    payingNow: 0,
  },
  {
    slNo: 22,
    feeHead: "CULTURAL FEE",
    actualDemand: 750,
    concession: 0,
    currentDemand: 750,
    paidSoFar: 750,
    payingNow: 0,
  },
  {
    slNo: 23,
    feeHead: "NEWS LETTER",
    actualDemand: 650,
    concession: 0,
    currentDemand: 650,
    paidSoFar: 650,
    payingNow: 0,
  },
  {
    slNo: 24,
    feeHead: "STUDENT PROJECT WORK FEE",
    actualDemand: 500,
    concession: 0,
    currentDemand: 500,
    paidSoFar: 500,
    payingNow: 0,
  },
  {
    slNo: 25,
    feeHead: "VTU MISCELLANEOUS AND REGISTRATION FEES",
    actualDemand: 3510,
    concession: 0,
    currentDemand: 3510,
    paidSoFar: 3510,
    payingNow: 0,
  },
];

const OPTIONAL_FEE_ITEMS: MandatoryFeeItem[] = [
  {
    slNo: 26,
    feeHead: "GRADECARD FEE",
    actualDemand: 500,
    concession: 0,
    currentDemand: 500,
    paidSoFar: 250,
    payingNow: 250,
  },
  {
    slNo: 27,
    feeHead: "FAST TRACK/RE-REGN/RE-APPEAR FEES",
    actualDemand: 0,
    concession: 0,
    currentDemand: 0,
    paidSoFar: 0,
    payingNow: 0,
  },
  {
    slNo: 28,
    feeHead: "REAPPEAR",
    actualDemand: 4000,
    concession: 0,
    currentDemand: 4000,
    paidSoFar: 2000,
    payingNow: 2000,
  },
  {
    slNo: 29,
    feeHead: "REAPPEAR FINE",
    actualDemand: 0,
    concession: 0,
    currentDemand: 0,
    paidSoFar: 0,
    payingNow: 0,
  },
];

export function AccountsView() {
  const [activeTab, setActiveTab] = useState<TabType>("search_student");

  // Comment Modal state
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentCategory, setCommentCategory] = useState("Select Category");
  const [commentText, setCommentText] = useState("");
  const [, setCommentFile] = useState<File | null>(null);

  // Search state
  const [usnSearch, setUsnSearch] = useState("1BM24EC0059-T");

  // Add Tuition Fee form state
  const [tuitionFeeForm, setTuitionFeeForm] = useState({
    usn: "1BM22CS115",
    studentName: "JAGANNATHAN K R",
    year: "IV",
    tuitionFee: "60686",
    vtuFee: "3510",
    autonomousExamFee: "3360",
    collegeMiscFee: "20000",
    arrearsTuitionFee: "0",
    arrearsComments: "",
    lateFeeArrears: "0",
    remarks: "",
    studentStatus: "Active",
    statusRemarks: "",
  });

  // Calculate total tuition fee automatically
  const calculatedTotalFee =
    (Number(tuitionFeeForm.tuitionFee) || 0) +
    (Number(tuitionFeeForm.vtuFee) || 0) +
    (Number(tuitionFeeForm.autonomousExamFee) || 0) +
    (Number(tuitionFeeForm.collegeMiscFee) || 0) +
    (Number(tuitionFeeForm.arrearsTuitionFee) || 0) +
    (Number(tuitionFeeForm.lateFeeArrears) || 0);

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  const handleSaveComment = () => {
    if (commentCategory === "Select Category") {
      toast.error("Please select a category");
      return;
    }
    toast.success("Comment saved successfully");
    setIsCommentModalOpen(false);
    setCommentCategory("Select Category");
    setCommentText("");
  };

  const handleUpdateTuitionFee = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Tuition fee updated successfully");
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] font-sans text-[#333]">
      {/* --- TOP HEADER --- */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Logo icon */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#e2e8f0] bg-[#1e293b] text-lg font-bold text-white">
            ⚙️
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#1e293b]">
            B.M.S. College of Engineering
          </h1>
        </div>
        <div className="text-sm font-semibold text-[#475569]">DEVAR...</div>
      </header>

      {/* --- TOP NAVIGATION BAR --- */}
      <nav className="flex items-center justify-between bg-[#2d3142] px-6 py-0 text-sm text-white shadow">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab("fee_structure")}
            className={`border-b-2 px-4 py-3 font-medium transition-colors ${
              activeTab === "fee_structure"
                ? "border-blue-400 bg-[#3b4058] text-white"
                : "border-transparent text-gray-200 hover:bg-[#3b4058]"
            }`}
          >
            Fee Structure
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("search_student")}
            className={`border-b-2 px-4 py-3 font-medium transition-colors ${
              activeTab === "search_student"
                ? "border-blue-400 bg-[#3b4058] text-white"
                : "border-transparent text-gray-200 hover:bg-[#3b4058]"
            }`}
          >
            Search Student
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`border-b-2 px-4 py-3 font-medium transition-colors ${
              activeTab === "reports"
                ? "border-blue-400 bg-[#3b4058] text-white"
                : "border-transparent text-gray-200 hover:bg-[#3b4058]"
            }`}
          >
            Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("add_tuition_fee")}
            className={`border-b-2 px-4 py-3 font-medium transition-colors ${
              activeTab === "add_tuition_fee"
                ? "border-blue-400 bg-[#3b4058] text-white"
                : "border-transparent text-gray-200 hover:bg-[#3b4058]"
            }`}
          >
            Add Tuition Fee
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => toast.info("Report Issue functionality initialized")}
            className="text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300"
          >
            REPORT ISSUE TO CONTINEO
          </button>
          <button
            type="button"
            onClick={() => setIsCommentModalOpen(true)}
            className="rounded bg-[#3b4058] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition hover:bg-[#484e6c]"
          >
            COMMENT BOX
          </button>
        </div>
      </nav>

      {/* --- MAIN CONTENT CONTAINER --- */}
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {/* ========================================== */}
        {/* TAB 1: SEARCH STUDENT & STUDENT BASIC DETAILS */}
        {/* ========================================== */}
        {activeTab === "search_student" && (
          <div className="space-y-6">
            {/* Search Box */}
            <div className="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-[#1e293b]">
                Student Admission Details:
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void usnSearch;
                }}
                className="flex max-w-lg items-center gap-4"
              >
                <label className="whitespace-nowrap text-sm font-semibold text-[#475569]">
                  Search Student USN:
                </label>
                <input
                  type="text"
                  value={usnSearch}
                  onChange={(e) => setUsnSearch(e.target.value)}
                  className="flex-1 rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter USN"
                />
                <button
                  type="submit"
                  className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  Search
                </button>
              </form>
            </div>

            {/* Student Comments Table */}
            <div className="space-y-3 rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-[#1e293b]">
                Student Comments
              </h2>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-[#f1f5f9] text-xs font-bold uppercase text-[#475569]">
                    <tr>
                      <th className="px-4 py-2.5">SL NO</th>
                      <th className="px-4 py-2.5">CATEGORY</th>
                      <th className="px-4 py-2.5">COMMENT</th>
                      <th className="px-4 py-2.5">DATE</th>
                      <th className="px-4 py-2.5">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-[#334155]">
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-4 text-center text-sm text-gray-500"
                      >
                        No comments found for this student.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student Basic Details Grid */}
            <div className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-[#1e293b]">
                Student Basic Details
              </h2>
              <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-700">
                    Name of student:
                  </span>
                  <span className="font-bold text-red-700">
                    Sujan R Vernekar
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("Sujan R Vernekar", "Name")}
                    className="ml-1 rounded border p-1 text-gray-600 hover:bg-gray-100"
                    title="Copy Name"
                  >
                    <Copy size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-700">
                    Category Allotted:
                  </span>
                  <span className="font-medium text-gray-800">GM</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-700">
                    Student Email :
                  </span>
                  <span className="text-gray-800">sujanr.ec24@bmsce.ac.in</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        "sujanr.ec24@bmsce.ac.in",
                        "Student Email"
                      )
                    }
                    className="ml-1 rounded border p-1 text-gray-600 hover:bg-gray-100"
                    title="Copy Email"
                  >
                    <Copy size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-700">
                    Father Cell :
                  </span>
                  <span className="text-gray-800">9844022438</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("9844022438", "Father Cell")}
                    className="ml-1 rounded border p-1 text-gray-600 hover:bg-gray-100"
                    title="Copy Phone"
                  >
                    <Copy size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-700">
                    Old Quota :
                  </span>
                  <span className="text-gray-500">—</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-700">
                    Date of Birth :
                  </span>
                  <span className="text-gray-800">08-06-2006</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("08-06-2006", "DOB")}
                    className="ml-1 rounded border p-1 text-gray-600 hover:bg-gray-100"
                    title="Copy DOB"
                  >
                    <Copy size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-700">
                    Student Cell :
                  </span>
                  <span className="text-gray-800">7338031413</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard("7338031413", "Student Cell")
                    }
                    className="ml-1 rounded border p-1 text-gray-600 hover:bg-gray-100"
                    title="Copy Phone"
                  >
                    <Copy size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-700">Old USN :</span>
                  <span className="text-gray-800">1BM24EC0059-T</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("1BM24EC0059-T", "Old USN")}
                    className="ml-1 rounded border p-1 text-gray-600 hover:bg-gray-100"
                    title="Copy Old USN"
                  >
                    <Copy size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-700">
                    Old Branch :
                  </span>
                  <span className="text-gray-500">—</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: ADD TUITION FEE FORM */}
        {/* ========================================== */}
        {activeTab === "add_tuition_fee" && (
          <div className="mx-auto max-w-3xl space-y-6 rounded-lg border bg-white p-8 shadow-sm">
            <h2 className="border-b pb-3 text-lg font-bold text-[#1e293b]">
              Add / Edit Tuition Fee
            </h2>

            <form
              onSubmit={handleUpdateTuitionFee}
              className="space-y-4 text-sm"
            >
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">USN</label>
                <input
                  type="text"
                  value={tuitionFeeForm.usn}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      usn: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border px-3 py-1.5 font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">
                  Student Name
                </label>
                <input
                  type="text"
                  value={tuitionFeeForm.studentName}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      studentName: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border px-3 py-1.5 font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">Year</label>
                <input
                  type="text"
                  value={tuitionFeeForm.year}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      year: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border px-3 py-1.5 font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">
                  Tuition Fee
                </label>
                <input
                  type="number"
                  value={tuitionFeeForm.tuitionFee}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      tuitionFee: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">VTU Fee</label>
                <input
                  type="number"
                  value={tuitionFeeForm.vtuFee}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      vtuFee: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">
                  Autonomous Exam Fee
                </label>
                <input
                  type="number"
                  value={tuitionFeeForm.autonomousExamFee}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      autonomousExamFee: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">
                  College Miscellaneous Fee
                </label>
                <input
                  type="number"
                  value={tuitionFeeForm.collegeMiscFee}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      collegeMiscFee: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">
                  Arrears Tuition Fee
                </label>
                <input
                  type="number"
                  value={tuitionFeeForm.arrearsTuitionFee}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      arrearsTuitionFee: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">
                  Arrears Comments
                </label>
                <textarea
                  rows={2}
                  value={tuitionFeeForm.arrearsComments}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      arrearsComments: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">
                  Late Fee Arrears
                </label>
                <input
                  type="number"
                  value={tuitionFeeForm.lateFeeArrears}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      lateFeeArrears: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">
                  Total Tuition Fee
                </label>
                <input
                  type="number"
                  readOnly
                  value={calculatedTotalFee}
                  className="col-span-2 rounded border bg-gray-50 px-3 py-1.5 font-bold text-gray-800"
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">Remarks</label>
                <textarea
                  rows={2}
                  value={tuitionFeeForm.remarks}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      remarks: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">
                  Student Status
                </label>
                <select
                  value={tuitionFeeForm.studentStatus}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      studentStatus: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border bg-white px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="Discontinued the course">
                    Discontinued the course
                  </option>
                  <option value="Temporary Withdrawal">
                    Temporary Withdrawal
                  </option>
                  <option value="Not attending the classes">
                    Not attending the classes
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-semibold text-[#475569]">
                  Status Remarks
                </label>
                <input
                  type="text"
                  value={tuitionFeeForm.statusRemarks}
                  onChange={(e) =>
                    setTuitionFeeForm({
                      ...tuitionFeeForm,
                      statusRemarks: e.target.value,
                    })
                  }
                  className="col-span-2 rounded border px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-start gap-3 pt-4">
                <button
                  type="submit"
                  className="rounded bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("search_student")}
                  className="rounded bg-gray-400 px-6 py-2 text-sm font-semibold text-white transition hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>

              <div className="pt-4 text-xs italic text-gray-500">
                Last Update by Devaraju - Staff Tuition UG on 02-06-2026 04:06
                PM
              </div>
            </form>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: FEE STRUCTURE & BREAKDOWN TABLE */}
        {/* ========================================== */}
        {activeTab === "fee_structure" && (
          <div className="space-y-5 rounded-lg border bg-white p-6 shadow-sm">
            {/* Top Bar */}
            <div className="flex flex-col items-start justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="rounded bg-[#800000] px-3 py-1 text-sm font-bold text-white">
                  Student wallet: Rs. 0/-
                </div>
              </div>
              <button
                type="button"
                onClick={() => toast.info("Fix Challan Issue requested")}
                className="text-sm font-bold text-red-600 hover:underline"
              >
                Fix Challan Issue
              </button>
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <select className="rounded border bg-white px-3 py-1.5 text-sm font-medium">
                <option>2025-2026 Year Fee Payment</option>
                <option>2024-2025 Year Fee Payment</option>
              </select>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toast.info("Installments opened")}
                  className="rounded border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Installments
                </button>
                <button
                  type="button"
                  onClick={() => toast.info("Add Concession opened")}
                  className="rounded border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Add Concession
                </button>
                <button
                  type="button"
                  onClick={() => toast.info("Edit Demand opened")}
                  className="rounded border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Edit Demand
                </button>
                <button
                  type="button"
                  onClick={() => toast.info("Add Fee head opened")}
                  className="rounded border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Add Fee head
                </button>
              </div>
            </div>

            {/* Fee Table */}
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-[#1e293b] font-semibold uppercase text-white">
                  <tr>
                    <th className="border-r px-3 py-2">SL NO.</th>
                    <th className="border-r px-3 py-2 text-center">SELECT</th>
                    <th className="border-r px-3 py-2">FEE HEAD</th>
                    <th className="border-r px-3 py-2 text-right">
                      ACTUAL DEMAND
                    </th>
                    <th className="border-r px-3 py-2 text-right">
                      CONCESSION
                    </th>
                    <th className="border-r px-3 py-2 text-right">
                      CURRENT DEMAND
                    </th>
                    <th className="border-r px-3 py-2 text-right">
                      PAID SO FAR
                    </th>
                    <th className="px-3 py-2 text-right">PAYING NOW</th>
                  </tr>
                </thead>

                <tbody>
                  {/* Mandatory Section Header */}
                  <tr className="border-b bg-gray-100 font-bold text-gray-800">
                    <td colSpan={8} className="px-3 py-2">
                      MANDATORY FEE HEADS
                    </td>
                  </tr>

                  {/* Mandatory Fee Rows */}
                  {MANDATORY_FEE_ITEMS.map((item) => (
                    <tr key={item.slNo} className="border-b hover:bg-gray-50">
                      <td className="border-r px-3 py-1.5">{item.slNo}</td>
                      <td className="border-r px-3 py-1.5 text-center">
                        <input type="checkbox" defaultChecked />
                      </td>
                      <td className="border-r px-3 py-1.5 font-medium">
                        {item.feeHead}
                      </td>
                      <td className="border-r px-3 py-1.5 text-right">
                        {item.actualDemand.toFixed(2)}
                      </td>
                      <td className="border-r px-3 py-1.5 text-right">
                        {item.concession.toFixed(2)}
                      </td>
                      <td className="border-r px-3 py-1.5 text-right">
                        {item.currentDemand.toFixed(2)}
                      </td>
                      <td className="border-r px-3 py-1.5 text-right">
                        {item.paidSoFar.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium">
                        {item.payingNow.toFixed(2)}
                      </td>
                    </tr>
                  ))}

                  {/* Mandatory Subtotal */}
                  <tr className="border-b bg-slate-100 font-bold text-slate-900">
                    <td
                      colSpan={3}
                      className="border-r px-3 py-2 text-right uppercase"
                    >
                      TOTAL
                    </td>
                    <td className="border-r px-3 py-2 text-right">26870.00</td>
                    <td className="border-r px-3 py-2 text-right">0.00</td>
                    <td className="border-r px-3 py-2 text-right">26870.00</td>
                    <td className="border-r px-3 py-2 text-right">26870.00</td>
                    <td className="px-3 py-2 text-right">0.00</td>
                  </tr>

                  {/* Optional Section Header */}
                  <tr className="border-b bg-gray-100 font-bold text-gray-800">
                    <td colSpan={8} className="px-3 py-2">
                      OPTIONAL FEE HEADS
                    </td>
                  </tr>

                  {/* Optional Fee Rows */}
                  {OPTIONAL_FEE_ITEMS.map((item) => (
                    <tr key={item.slNo} className="border-b hover:bg-gray-50">
                      <td className="border-r px-3 py-1.5">{item.slNo}</td>
                      <td className="border-r px-3 py-1.5 text-center">
                        <input type="checkbox" />
                      </td>
                      <td className="border-r px-3 py-1.5 font-medium">
                        {item.feeHead}
                      </td>
                      <td className="border-r px-3 py-1.5 text-right">
                        {item.actualDemand.toFixed(2)}
                      </td>
                      <td className="border-r px-3 py-1.5 text-right">
                        {item.concession.toFixed(2)}
                      </td>
                      <td className="border-r px-3 py-1.5 text-right">
                        {item.currentDemand.toFixed(2)}
                      </td>
                      <td className="border-r px-3 py-1.5 text-right">
                        {item.paidSoFar.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium">
                        {item.payingNow.toFixed(2)}
                      </td>
                    </tr>
                  ))}

                  {/* Grand Total */}
                  <tr className="border-b bg-slate-200 font-extrabold text-slate-900">
                    <td
                      colSpan={3}
                      className="border-r px-3 py-2.5 text-right uppercase"
                    >
                      GRAND TOTAL
                    </td>
                    <td className="border-r px-3 py-2.5 text-right">
                      31370.00
                    </td>
                    <td className="border-r px-3 py-2.5 text-right">0.00</td>
                    <td className="border-r px-3 py-2.5 text-right">
                      31370.00
                    </td>
                    <td className="border-r px-3 py-2.5 text-right">2250.00</td>
                    <td className="px-3 py-2.5 text-right">0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => toast.success("Challan generated successfully")}
                className="rounded bg-[#800000] px-5 py-2 text-xs font-bold text-white shadow transition hover:bg-[#660000]"
              >
                Generate Challan
              </button>
              <button
                type="button"
                onClick={() => toast.info("Redirecting to Online Payment")}
                className="rounded bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow transition hover:bg-blue-700"
              >
                Pay online
              </button>
            </div>

            {/* Payment History Section */}
            <div className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1e293b]">
                PAYMENT HISTORY
              </h3>
              <p className="text-xs font-medium text-gray-600">
                Payment Updated
              </p>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: REPORTS VIEW PLACEHOLDER */}
        {/* ========================================== */}
        {activeTab === "reports" && (
          <div className="rounded-lg border bg-white p-12 text-center text-gray-500 shadow-sm">
            <h2 className="mb-2 text-base font-bold text-gray-700">
              Accounts Reports & Analytics
            </h2>
            <p className="text-sm">
              Generate fee collection reports, pending balance sheets, and audit
              logs.
            </p>
          </div>
        )}
      </main>

      {/* ========================================== */}
      {/* COMMENT BOX MODAL DIALOG */}
      {/* ========================================== */}
      {isCommentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-lg border bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4">
              <h3 className="text-lg font-semibold text-[#1e293b]">
                Comment Box
              </h3>
              <button
                type="button"
                onClick={() => setIsCommentModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 p-6 text-sm">
              <div className="space-y-1">
                <label className="block font-medium text-gray-700">
                  Category
                </label>
                <select
                  value={commentCategory}
                  onChange={(e) => setCommentCategory(e.target.value)}
                  className="w-full rounded border bg-white px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Select Category">Select Category</option>
                  <option value="Others">Others</option>
                  <option value="Installments">Installments</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-medium text-gray-700">
                  Comment
                </label>
                <textarea
                  rows={4}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Enter your message..."
                  className="w-full rounded border px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-medium text-gray-700">
                  Upload Document
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    onChange={(e) =>
                      setCommentFile(e.target.files?.[0] || null)
                    }
                    className="block w-full cursor-pointer text-xs text-gray-500 file:mr-4 file:rounded file:border file:border-gray-300 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold hover:file:bg-gray-200"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsCommentModalOpen(false)}
                className="rounded border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600 transition hover:bg-gray-100"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleSaveComment}
                className="rounded bg-[#cc0000] px-6 py-2 text-xs font-bold uppercase tracking-wider text-white shadow transition hover:bg-[#aa0000]"
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FOOTER --- */}
      <footer className="mt-16 flex flex-col items-center justify-between gap-2 border-t bg-white px-6 py-4 text-xs text-gray-500 sm:flex-row">
        <div>Copyright © Powered By Contineo</div>
        <div>Terms of Service | Privacy Policy</div>
      </footer>
    </div>
  );
}
