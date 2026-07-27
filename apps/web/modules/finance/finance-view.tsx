"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Separator } from "@webcampus/ui/components/separator";
import { Search, WalletCards } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "react-toastify";

type FinanceGroup = "trustee" | "accounts";
type PaymentStatus = "PAID" | "PARTIALLY_PAID" | "UNPAID";

type FinanceStudent = {
  id: string;
  name: string;
  usn: string;
  applicationNumber: string | null;
  quota: string | null;
  dob: string | null;
  claimedCategory: string | null;
  allottedCategory: string | null;
  course: string;
  currentSemester: number;
  studentPhone: string | null;
  studentEmail: string | null;
  fatherPhone: string | null;
  temporaryUsn: string | null;
  previousBranch: string | null;
  previousQuota: string | null;
  finance: {
    id: string;
    academicYear: string;
    actualDemand: number;
    amountPaid: number;
    remainingBalance: number;
    paymentStatus: PaymentStatus;
    payments: {
      id: string;
      amount: number;
      paidAt: string;
      reference: string | null;
    }[];
  } | null;
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const display = (value: string | number | null | undefined) => value || "—";

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="break-words text-sm font-medium">{display(value)}</p>
    </div>
  );
}

export function FinanceView() {
  const queryClient = useQueryClient();
  const [group, setGroup] = useState<FinanceGroup>("trustee");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState(
    `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
  );
  const [finalFee, setFinalFee] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  const searchQuery = useQuery({
    queryKey: ["finance-students", group, submittedSearch],
    enabled: submittedSearch.length > 0,
    queryFn: async () =>
      (
        await apiClient.get("/finance/students", {
          params: { query: submittedSearch, group },
        })
      ).data.data as FinanceStudent[],
  });
  const studentQuery = useQuery({
    queryKey: ["finance-student", selectedId, academicYear],
    enabled: Boolean(selectedId),
    queryFn: async () =>
      (
        await apiClient.get(`/finance/students/${selectedId}`, {
          params: { academicYear },
        })
      ).data.data as FinanceStudent,
  });
  const student = studentQuery.data;

  const saveFee = useMutation({
    mutationFn: async () =>
      apiClient.put(`/finance/students/${selectedId}/fee`, {
        academicYear,
        finalFee: Number(finalFee),
      }),
    onSuccess: () => {
      toast.success("Final fee saved");
      queryClient.invalidateQueries({
        queryKey: ["finance-student", selectedId],
      });
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Unable to save fee")),
  });
  const addPayment = useMutation({
    mutationFn: async () =>
      apiClient.post(`/finance/${student?.finance?.id}/payments`, {
        amount: Number(paymentAmount),
      }),
    onSuccess: () => {
      setPaymentAmount("");
      toast.success("Payment recorded");
      queryClient.invalidateQueries({
        queryKey: ["finance-student", selectedId],
      });
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Unable to record payment")),
  });

  const paymentBadge = useMemo(() => {
    const status = student?.finance?.paymentStatus;
    if (status === "PAID")
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-600">Paid</Badge>
      );
    if (status === "PARTIALLY_PAID")
      return (
        <Badge className="bg-amber-500 hover:bg-amber-500">
          Partially Paid
        </Badge>
      );
    return <Badge variant="destructive">Unpaid</Badge>;
  }, [student?.finance?.paymentStatus]);

  const runSearch = (event: FormEvent) => {
    event.preventDefault();
    setSelectedId(null);
    setSubmittedSearch(search.trim());
  };
  const selectStudent = (candidate: FinanceStudent) => {
    setSelectedId(candidate.id);
    setFinalFee(candidate.finance?.actualDemand?.toString() ?? "");
    setAcademicYear(candidate.finance?.academicYear ?? academicYear);
  };
  const changeGroup = (next: FinanceGroup) => {
    setGroup(next);
    setSelectedId(null);
    setSubmittedSearch("");
    setSearch("");
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
          <p className="text-muted-foreground text-sm">
            Search students, maintain first-year fees, and review payment
            balances.
          </p>
        </div>
        <div className="flex rounded-lg border p-1">
          <Button
            type="button"
            variant={group === "trustee" ? "default" : "ghost"}
            size="sm"
            onClick={() => changeGroup("trustee")}
          >
            Trustee
          </Button>
          <Button
            type="button"
            variant={group === "accounts" ? "default" : "ghost"}
            size="sm"
            onClick={() => changeGroup("accounts")}
          >
            Accounts
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Student search</CardTitle>
          <CardDescription>
            {group === "trustee"
              ? "Management quota records"
              : "KCET, COMEDK, and other non-management quota records"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={runSearch}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by student name, USN, or first-year application number"
            />
            <Button
              type="submit"
              disabled={!search.trim() || searchQuery.isFetching}
            >
              <Search /> Search
            </Button>
          </form>
          {searchQuery.isError && (
            <p className="text-destructive text-sm">
              {getApiErrorMessage(
                searchQuery.error,
                "Unable to search students"
              )}
            </p>
          )}
          {searchQuery.data && (
            <div className="overflow-hidden rounded-md border">
              {searchQuery.data.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">
                  No matching students found.
                </p>
              ) : (
                searchQuery.data.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => selectStudent(candidate)}
                    className="hover:bg-muted/60 flex w-full items-center justify-between gap-4 border-b p-3 text-left last:border-0"
                  >
                    <span>
                      <span className="block font-medium">
                        {candidate.name}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {candidate.usn} ·{" "}
                        {candidate.applicationNumber ?? "No application number"}
                      </span>
                    </span>
                    <Badge variant="outline">{candidate.quota ?? "—"}</Badge>
                  </button>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {studentQuery.isFetching && (
        <p className="text-muted-foreground text-sm">
          Loading student finance details...
        </p>
      )}
      {student && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Student details</CardTitle>
              <CardDescription>
                Read-only admissions and student information
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Student Name" value={student.name} />
              <Detail label="USN" value={student.usn} />
              <Detail label="Quota" value={student.quota} />
              <Detail
                label="Date of Birth"
                value={
                  student.dob
                    ? new Date(student.dob).toLocaleDateString("en-IN")
                    : null
                }
              />
              <Detail
                label="Claimed Category"
                value={student.claimedCategory}
              />
              <Detail
                label="Allotted Category"
                value={student.allottedCategory}
              />
              <Detail label="Course" value={student.course} />
              <Detail
                label="Current Semester"
                value={student.currentSemester}
              />
              <Detail
                label="Student Phone Number"
                value={student.studentPhone}
              />
              <Detail label="Student Email" value={student.studentEmail} />
              <Detail
                label="Father's Phone Number"
                value={student.fatherPhone}
              />
              <Detail label="Temporary USN" value={student.temporaryUsn} />
              <Detail label="Previous Branch" value={student.previousBranch} />
              <Detail label="Previous Quota" value={student.previousQuota} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fee summary</CardTitle>
              <CardDescription>
                {student.finance?.academicYear ?? academicYear}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Detail
                label="Actual Demand"
                value={currency.format(student.finance?.actualDemand ?? 0)}
              />
              <Detail
                label="Amount Paid"
                value={currency.format(student.finance?.amountPaid ?? 0)}
              />
              <div
                className={
                  student.finance?.remainingBalance
                    ? "bg-destructive/10 rounded-md p-3"
                    : "bg-muted rounded-md p-3"
                }
              >
                <Detail
                  label="Remaining Balance"
                  value={currency.format(
                    student.finance?.remainingBalance ?? 0
                  )}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  Payment Status
                </span>
                {paymentBadge}
              </div>
            </CardContent>
          </Card>
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Fee management</CardTitle>
              <CardDescription>
                Set the final fee for the student's first academic year.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveFee.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="finance-year">Academic Year</Label>
                  <Input
                    id="finance-year"
                    value={academicYear}
                    onChange={(event) => setAcademicYear(event.target.value)}
                    placeholder="2026-2027"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-fee">Final Fee Amount</Label>
                  <Input
                    id="finance-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={finalFee}
                    onChange={(event) => setFinalFee(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={
                      !academicYear || finalFee === "" || saveFee.isPending
                    }
                    className="w-full"
                  >
                    Save fee
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Record payment</CardTitle>
              <CardDescription>
                Amounts update the total paid and balance automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {student.finance ? (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addPayment.mutate();
                  }}
                >
                  <Input
                    aria-label="Payment amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    placeholder="Payment amount"
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!paymentAmount || addPayment.isPending}
                  >
                    <WalletCards /> Record payment
                  </Button>
                </form>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Save a final fee before recording payments.
                </p>
              )}
            </CardContent>
          </Card>
          {student.finance?.payments.length ? (
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle className="text-lg">Payment history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {student.finance.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {new Date(payment.paidAt).toLocaleDateString("en-IN")}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                    </span>
                    <span className="font-medium">
                      {currency.format(payment.amount)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
