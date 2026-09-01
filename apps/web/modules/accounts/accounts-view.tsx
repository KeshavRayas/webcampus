"use client";

import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
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
  { slNo: 1, feeHead: "STUDENT FEEDBACK FEES", actualDemand: 250, concession: 0, currentDemand: 250, paidSoFar: 250, payingNow: 0 },
  { slNo: 2, feeHead: "SPORTS AND GAMES", actualDemand: 50, concession: 0, currentDemand: 50, paidSoFar: 50, payingNow: 0 },
  { slNo: 3, feeHead: "ASSOCIATION FEE", actualDemand: 50, concession: 0, currentDemand: 50, paidSoFar: 50, payingNow: 0 },
  { slNo: 4, feeHead: "READING ROOM FEE LIBRARY", actualDemand: 75, concession: 0, currentDemand: 75, paidSoFar: 75, payingNow: 0 },
  { slNo: 5, feeHead: "MEDICAL EXAM FEE", actualDemand: 20, concession: 0, currentDemand: 20, paidSoFar: 20, payingNow: 0 },
  { slNo: 6, feeHead: "MAGAZINE FEE", actualDemand: 25, concession: 0, currentDemand: 25, paidSoFar: 25, payingNow: 0 },
  { slNo: 7, feeHead: "HAND BOOK", actualDemand: 50, concession: 0, currentDemand: 50, paidSoFar: 50, payingNow: 0 },
  { slNo: 8, feeHead: "REGISTRATION FEE", actualDemand: 100, concession: 0, currentDemand: 100, paidSoFar: 100, payingNow: 0 },
  { slNo: 9, feeHead: "STUDENT TEACHER WELFARE FUND", actualDemand: 500, concession: 0, currentDemand: 500, paidSoFar: 500, payingNow: 0 },
  { slNo: 10, feeHead: "FLAG FEE", actualDemand: 75, concession: 0, currentDemand: 75, paidSoFar: 75, payingNow: 0 },
  { slNo: 11, feeHead: "MEDICLAIM/ACCIDENT INSURANCE", actualDemand: 1138, concession: 0, currentDemand: 1138, paidSoFar: 1138, payingNow: 0 },
  { slNo: 12, feeHead: "DATA CENTER FEE", actualDemand: 2100, concession: 0, currentDemand: 2100, paidSoFar: 2100, payingNow: 0 },
  { slNo: 13, feeHead: "LIBRARY FEE", actualDemand: 1400, concession: 0, currentDemand: 1400, paidSoFar: 1400, payingNow: 0 },
  { slNo: 14, feeHead: "READING ROOM FEE", actualDemand: 25, concession: 0, currentDemand: 25, paidSoFar: 25, payingNow: 0 },
  { slNo: 15, feeHead: "JOURNALS FEES", actualDemand: 1650, concession: 0, currentDemand: 1650, paidSoFar: 1650, payingNow: 0 },
  { slNo: 16, feeHead: "AUTONOMOUS EXAM FEE", actualDemand: 3360, concession: 0, currentDemand: 3360, paidSoFar: 3360, payingNow: 0 },
  { slNo: 17, feeHead: "LABORATORY CHARGES", actualDemand: 1500, concession: 0, currentDemand: 1500, paidSoFar: 1500, payingNow: 0 },
  { slNo: 18, feeHead: "MAINTAINANCE FEE", actualDemand: 5242, concession: 0, currentDemand: 5242, paidSoFar: 5242, payingNow: 0 },
  { slNo: 19, feeHead: "E-GOVERNANCE", actualDemand: 250, concession: 0, currentDemand: 250, paidSoFar: 250, payingNow: 0 },
  { slNo: 20, feeHead: "INTERNET FEE", actualDemand: 2900, concession: 0, currentDemand: 2900, paidSoFar: 2900, payingNow: 0 },
  { slNo: 21, feeHead: "SPORTS FEE", actualDemand: 700, concession: 0, currentDemand: 700, paidSoFar: 700, payingNow: 0 },
  { slNo: 22, feeHead: "CULTURAL FEE", actualDemand: 750, concession: 0, currentDemand: 750, paidSoFar: 750, payingNow: 0 },
  { slNo: 23, feeHead: "NEWS LETTER", actualDemand: 650, concession: 0, currentDemand: 650, paidSoFar: 650, payingNow: 0 },
  { slNo: 24, feeHead: "STUDENT PROJECT WORK FEE", actualDemand: 500, concession: 0, currentDemand: 500, paidSoFar: 500, payingNow: 0 },
  { slNo: 25, feeHead: "VTU MISCELLANEOUS AND REGISTRATION FEES", actualDemand: 3510, concession: 0, currentDemand: 3510, paidSoFar: 3510, payingNow: 0 },
];

const OPTIONAL_FEE_ITEMS: MandatoryFeeItem[] = [
  { slNo: 26, feeHead: "GRADECARD FEE", actualDemand: 500, concession: 0, currentDemand: 500, paidSoFar: 250, payingNow: 250 },
  { slNo: 27, feeHead: "FAST TRACK/RE-REGN/RE-APPEAR FEES", actualDemand: 0, concession: 0, currentDemand: 0, paidSoFar: 0, payingNow: 0 },
  { slNo: 28, feeHead: "REAPPEAR", actualDemand: 4000, concession: 0, currentDemand: 4000, paidSoFar: 2000, payingNow: 2000 },
  { slNo: 29, feeHead: "REAPPEAR FINE", actualDemand: 0, concession: 0, currentDemand: 0, paidSoFar: 0, payingNow: 0 },
];

const TABS: { id: TabType; label: string }[] = [
  { id: "search_student", label: "Search Student" },
  { id: "fee_structure", label: "Fee Structure" },
  { id: "add_tuition_fee", label: "Add Tuition Fee" },
  { id: "reports", label: "Reports" },
];

const inputClass =
  "h-[3.15rem] w-full rounded-md border border-foreground/20 bg-background px-4 text-sm shadow-none outline-none focus:border-foreground/50 focus:outline-none";
const labelClass =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function AccountsView() {
  const [activeTab, setActiveTab] = useState<TabType>("search_student");

  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentCategory, setCommentCategory] = useState("Select Category");
  const [commentText, setCommentText] = useState("");
  const [, setCommentFile] = useState<File | null>(null);

  const [usnSearch, setUsnSearch] = useState("1BM24EC0059-T");

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

  const calculatedTotalFee =
    (Number(tuitionFeeForm.tuitionFee) || 0) +
    (Number(tuitionFeeForm.vtuFee) || 0) +
    (Number(tuitionFeeForm.autonomousExamFee) || 0) +
    (Number(tuitionFeeForm.collegeMiscFee) || 0) +
    (Number(tuitionFeeForm.arrearsTuitionFee) || 0) +
    (Number(tuitionFeeForm.lateFeeArrears) || 0);

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
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex flex-wrap items-center gap-2 rounded-[1.15rem] border border-foreground/15 bg-card p-1.5">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-10 flex-1 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Student */}
      {activeTab === "search_student" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search student by USN</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void usnSearch;
                }}
                className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2"
              >
                <input
                  type="text"
                  value={usnSearch}
                  onChange={(e) => setUsnSearch(e.target.value)}
                  className={inputClass}
                  placeholder="Enter USN"
                />
                <Button type="submit" className="h-[3.15rem] w-full">
                  Search
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student basic details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Name of student", value: "Sujan R Vernekar" },
                { label: "Category allotted", value: "GM" },
                { label: "Student email", value: "sujanr.ec24@bmsce.ac.in" },
                { label: "Father cell", value: "9844022438" },
                { label: "Old quota", value: "—" },
                { label: "Date of birth", value: "08-06-2006" },
                { label: "Student cell", value: "7338031413" },
                { label: "Old USN", value: "1BM24EC0059-T" },
                { label: "Old branch", value: "—" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-foreground/10 bg-background px-4 py-3"
                >
                  <div>
                    <p className={labelClass}>{label}</p>
                    <p className="mt-1 text-sm font-medium">{value}</p>
                  </div>
                  {value !== "—" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => copyToClipboard(value, label)}
                      title={`Copy ${label}`}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student comments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No comments found for this student.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Tuition Fee Form */}
      {activeTab === "add_tuition_fee" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add / edit tuition fee</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateTuitionFee} className="space-y-4">
              {[
                { key: "usn" as const, label: "USN", value: tuitionFeeForm.usn, type: "text" },
                { key: "studentName" as const, label: "Student name", value: tuitionFeeForm.studentName, type: "text" },
                { key: "year" as const, label: "Year", value: tuitionFeeForm.year, type: "text" },
                { key: "tuitionFee" as const, label: "Tuition fee", value: tuitionFeeForm.tuitionFee, type: "number" },
                { key: "vtuFee" as const, label: "VTU fee", value: tuitionFeeForm.vtuFee, type: "number" },
                { key: "autonomousExamFee" as const, label: "Autonomous exam fee", value: tuitionFeeForm.autonomousExamFee, type: "number" },
                { key: "collegeMiscFee" as const, label: "College misc fee", value: tuitionFeeForm.collegeMiscFee, type: "number" },
                { key: "arrearsTuitionFee" as const, label: "Arrears tuition fee", value: tuitionFeeForm.arrearsTuitionFee, type: "number" },
                { key: "lateFeeArrears" as const, label: "Late fee arrears", value: tuitionFeeForm.lateFeeArrears, type: "number" },
                { key: "statusRemarks" as const, label: "Status remarks", value: tuitionFeeForm.statusRemarks, type: "text" },
              ].map(({ key, label, value, type }) => (
                <div key={key} className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:items-center">
                  <label className={labelClass}>{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={(e) =>
                      setTuitionFeeForm({ ...tuitionFeeForm, [key]: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              ))}

              <div className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:items-center">
                <label className={labelClass}>Arrears comments</label>
                <textarea
                  rows={2}
                  value={tuitionFeeForm.arrearsComments}
                  onChange={(e) =>
                    setTuitionFeeForm({ ...tuitionFeeForm, arrearsComments: e.target.value })
                  }
                  className="min-h-20 rounded-[1.15rem] border border-foreground/20 bg-background px-4 py-3 text-sm shadow-none outline-none focus:border-foreground/50 focus:outline-none"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:items-center">
                <label className={labelClass}>Remarks</label>
                <textarea
                  rows={2}
                  value={tuitionFeeForm.remarks}
                  onChange={(e) =>
                    setTuitionFeeForm({ ...tuitionFeeForm, remarks: e.target.value })
                  }
                  className="min-h-20 rounded-[1.15rem] border border-foreground/20 bg-background px-4 py-3 text-sm shadow-none outline-none focus:border-foreground/50 focus:outline-none"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:items-center">
                <label className={labelClass}>Student status</label>
                <select
                  value={tuitionFeeForm.studentStatus}
                  onChange={(e) =>
                    setTuitionFeeForm({ ...tuitionFeeForm, studentStatus: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="Active">Active</option>
                  <option value="Discontinued the course">Discontinued the course</option>
                  <option value="Temporary Withdrawal">Temporary Withdrawal</option>
                  <option value="Not attending the classes">Not attending the classes</option>
                </select>
              </div>

              <div className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:items-center">
                <label className={labelClass}>Total tuition fee</label>
                <input type="number" readOnly value={calculatedTotalFee} className={inputClass} />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" className="min-h-[3.15rem]">
                  Update
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[3.15rem]"
                  onClick={() => setActiveTab("search_student")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Fee Structure */}
      {activeTab === "fee_structure" && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Fee structure</CardTitle>
            <Badge variant="outline" className="w-full justify-center">
              Student wallet: Rs. 0/-
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <select className={inputClass}>
                <option>2025-2026 Year Fee Payment</option>
                <option>2024-2025 Year Fee Payment</option>
              </select>
              <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                <Button variant="outline" onClick={() => toast.info("Installments opened")}>
                  Installments
                </Button>
                <Button variant="outline" onClick={() => toast.info("Add Concession opened")}>
                  Add Concession
                </Button>
                <Button variant="outline" onClick={() => toast.info("Edit Demand opened")}>
                  Edit Demand
                </Button>
                <Button variant="outline" onClick={() => toast.info("Add Fee head opened")}>
                  Add Fee head
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[1.15rem] border border-foreground/15">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3">SL NO.</th>
                    <th className="px-4 py-3">FEE HEAD</th>
                    <th className="px-4 py-3 text-right">ACTUAL DEMAND</th>
                    <th className="px-4 py-3 text-right">CONCESSION</th>
                    <th className="px-4 py-3 text-right">CURRENT DEMAND</th>
                    <th className="px-4 py-3 text-right">PAID SO FAR</th>
                    <th className="px-4 py-3 text-right">PAYING NOW</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={7} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Mandatory fee heads
                    </td>
                  </tr>
                  {MANDATORY_FEE_ITEMS.map((item) => (
                    <tr key={item.slNo} className="border-t border-foreground/8">
                      <td className="px-4 py-2.5">{item.slNo}</td>
                      <td className="px-4 py-2.5 font-medium">{item.feeHead}</td>
                      <td className="px-4 py-2.5 text-right">{item.actualDemand.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">{item.concession.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">{item.currentDemand.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">{item.paidSoFar.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{item.payingNow.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={7} className="rounded-[1.15rem] px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Optional fee heads
                    </td>
                  </tr>
                  {OPTIONAL_FEE_ITEMS.map((item) => (
                    <tr key={item.slNo} className="border-t border-foreground/8">
                      <td className="px-4 py-2.5">{item.slNo}</td>
                      <td className="px-4 py-2.5 font-medium">{item.feeHead}</td>
                      <td className="px-4 py-2.5 text-right">{item.actualDemand.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">{item.concession.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">{item.currentDemand.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">{item.paidSoFar.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{item.payingNow.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports */}
      {activeTab === "reports" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accounts reports &amp; analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Generate fee collection reports, pending balance sheets, and audit logs.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Comment Modal */}
      {isCommentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="role-console w-full max-w-lg rounded-[1.15rem] border border-foreground/15 bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Comment Box</h3>
              <button
                type="button"
                onClick={() => setIsCommentModalOpen(false)}
                className="size-8 rounded-full text-muted-foreground hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Category</label>
                <select
                  value={commentCategory}
                  onChange={(e) => setCommentCategory(e.target.value)}
                  className={inputClass}
                >
                  <option value="Select Category">Select Category</option>
                  <option value="Others">Others</option>
                  <option value="Installments">Installments</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Comment</label>
                <textarea
                  rows={4}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Enter your message..."
                  className="min-h-28 w-full rounded-[1.15rem] border border-foreground/20 bg-background px-4 py-3 text-sm shadow-none outline-none focus:border-foreground/50 focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Upload document</label>
                <input
                  type="file"
                  onChange={(e) => setCommentFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-muted-foreground file:mr-4 file:rounded-full file:border file:border-foreground/20 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-semibold"
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="outline" className="min-h-[3.15rem]" onClick={() => setIsCommentModalOpen(false)}>
                Cancel
              </Button>
              <Button className="min-h-[3.15rem]" onClick={handleSaveComment}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
