"use client";

import { useDepartments } from "@/lib/use-departments";
import { useSections } from "@/lib/use-sections";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { Card, CardContent } from "@webcampus/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { Eye, Loader2, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { MultiSelect } from "./multi-select";
import { CATEGORY_LABELS, RECIPIENT_LABELS } from "./template-form";
import type {
  MessageCategory,
  MessageChannel,
  MessageScope,
  PreviewResult,
  SendConfig,
  SendResult,
} from "./types";
import {
  useMessageTemplates,
  useSendMessage,
  useSendPreview,
  useWhatsAppCourses,
} from "./use-templates";

type Scope = MessageScope;

export const SendView = () => {
  const [academicTermId, setAcademicTermId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [scope, setScope] = useState<Scope>("STUDENT");
  const [studentTemplateId, setStudentTemplateId] = useState("");
  const [parentTemplateId, setParentTemplateId] = useState("");
  const [channel, setChannel] = useState<MessageChannel>("WHATSAPP");

  const [cieNumber, setCieNumber] = useState<1 | 2 | 3>(1);
  const [subjectMode, setSubjectMode] = useState<"all" | "custom">("all");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [ptmDate, setPtmDate] = useState("");
  const [ptmTime, setPtmTime] = useState("");
  const [ptmVenu, setPtmVenu] = useState("");

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set()
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];
  const { data: departments = [] } = useDepartments();
  const { data: sections = [], isLoading: sectionsLoading } = useSections(
    semesterId,
    departmentId
  );
  const { data: allTemplates = [] } = useMessageTemplates();
  const { data: courses = [] } = useWhatsAppCourses(semesterId, departmentId);

  const previewMutation = useSendPreview();
  const sendMutation = useSendMessage();

  const selectedTerm = terms.find((t) => t.id === academicTermId);
  const semesterOptions = selectedTerm?.Semester ?? [];

  const activeCategory: MessageCategory | null = useMemo(() => {
    const student = allTemplates.find((t) => t.id === studentTemplateId);
    if (student) return student.category;
    const parent = allTemplates.find((t) => t.id === parentTemplateId);
    if (parent) return parent.category;
    return null;
  }, [allTemplates, studentTemplateId, parentTemplateId]);

  const studentTemplates = useMemo(
    () =>
      allTemplates.filter(
        (t) =>
          t.recipientType === "STUDENT" &&
          (activeCategory ? t.category === activeCategory : true)
      ),
    [allTemplates, activeCategory]
  );
  const parentTemplates = useMemo(
    () =>
      allTemplates.filter(
        (t) =>
          t.recipientType === "PARENT" &&
          (activeCategory ? t.category === activeCategory : true)
      ),
    [allTemplates, activeCategory]
  );

  const allSelected =
    preview !== null &&
    preview.recipients.length > 0 &&
    selectedStudentIds.size ===
      new Set(preview.recipients.map((r) => r.studentId)).size;

  const buildConfig = (customStudentIds?: string[]): SendConfig => {
    const adHocData =
      activeCategory === "BALANCE_FEE" || activeCategory === "ANNUAL_FEE"
        ? { deadline: deadline || undefined }
        : activeCategory === "PARENT_TEACHER_MEETING"
          ? {
              ptmDate: ptmDate || undefined,
              ptmTime: ptmTime || undefined,
              ptmVenu: ptmVenu || undefined,
            }
          : undefined;
    return {
      channel,
      academicTermId: academicTermId || undefined,
      departmentId: departmentId || undefined,
      semesterId: semesterId || undefined,
      sectionIds,
      scope,
      studentTemplateId: studentTemplateId || undefined,
      parentTemplateId: parentTemplateId || undefined,
      cieNumber: activeCategory === "CIE" ? cieNumber : undefined,
      subjectIds:
        activeCategory === "CIE" && subjectMode === "custom"
          ? subjectIds
          : undefined,
      adHocData,
      studentIds: customStudentIds,
    };
  };

  const validate = (): string | null => {
    if (sectionIds.length === 0) return "Select at least one section";
    if (scope === "STUDENT" || scope === "BOTH") {
      if (!studentTemplateId) return "Select a student template";
    }
    if (scope === "PARENT" || scope === "BOTH") {
      if (!parentTemplateId) return "Select a parent template";
    }
    if (
      activeCategory === "CIE" &&
      subjectMode === "custom" &&
      subjectIds.length === 0
    ) {
      return "Select at least one subject";
    }
    return null;
  };

  const handleLoad = () => {
    const error = validate();
    if (error) return toast.error(error);
    previewMutation.mutate(buildConfig(), {
      onSuccess: (data) => {
        setPreview(data);
        setSelectedStudentIds(new Set(data.recipients.map((r) => r.studentId)));
        toast.success(
          `${data.totalCount} recipient(s) loaded${data.skippedCount > 0 ? `, ${data.skippedCount} skipped (no phone)` : ""}`
        );
      },
      onError: (error) =>
        toast.error(
          error instanceof Error ? error.message : "Failed to load recipients"
        ),
    });
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleAll = () => {
    if (!preview) return;
    const allIds = new Set(preview.recipients.map((r) => r.studentId));
    setSelectedStudentIds(allSelected ? new Set() : allIds);
  };

  const handleConfirmSend = () => {
    const custom = allSelected ? undefined : Array.from(selectedStudentIds);
    setConfirmOpen(false);
    sendMutation.mutate(buildConfig(custom), {
      onSuccess: (data) => {
        setResult(data);
        setResultOpen(true);
        setPreview(null);
        setSelectedStudentIds(new Set());
      },
      onError: (error) =>
        toast.error(
          error instanceof Error ? error.message : "Failed to send messages"
        ),
    });
  };

  const previewSamples = useMemo(() => {
    if (!preview) return [];
    const seen = new Set<string>();
    return preview.recipients.filter((r) => {
      const key = `${r.templateId}:${r.messageText}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [preview]);

  const selectedCount = selectedStudentIds.size;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Send WhatsApp</h2>
        <p className="text-muted-foreground text-sm">
          Compose a broadcast by filtering term, department, semester, section
          and message template.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Academic Term</Label>
              <Select value={academicTermId} onValueChange={setAcademicTermId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.type.toUpperCase()} {term.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Semester</Label>
              <Select
                value={semesterId}
                onValueChange={(value) => {
                  setSemesterId(value);
                  setSectionIds([]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      academicTermId ? "Select semester" : "Select term first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {semesterOptions.map((semester) => (
                    <SelectItem key={semester.id} value={semester.id}>
                      {semester.programType} - Semester{" "}
                      {semester.semesterNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sections (one or multiple)</Label>
            <MultiSelect
              options={sections.map((s) => ({ value: s.id, label: s.name }))}
              selected={sectionIds}
              onChange={setSectionIds}
              placeholder={
                sectionsLoading
                  ? "Loading sections..."
                  : semesterId && departmentId
                    ? "Select sections"
                    : "Select semester and department first"
              }
              disabled={!semesterId || !departmentId}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select
                value={scope}
                onValueChange={(value) => setScope(value as Scope)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Student</SelectItem>
                  <SelectItem value="PARENT">Parent</SelectItem>
                  <SelectItem value="BOTH">Both (student + parent)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(scope === "STUDENT" || scope === "BOTH") && (
              <div className="space-y-2">
                <Label>Student Template</Label>
                <Select
                  value={studentTemplateId}
                  onValueChange={setStudentTemplateId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select student template" />
                  </SelectTrigger>
                  <SelectContent>
                    {studentTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(scope === "PARENT" || scope === "BOTH") && (
              <div className="space-y-2">
                <Label>Parent Template</Label>
                <Select
                  value={parentTemplateId}
                  onValueChange={setParentTemplateId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select parent template" />
                  </SelectTrigger>
                  <SelectContent>
                    {parentTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {activeCategory === "CIE" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>CIE Number</Label>
                <Select
                  value={String(cieNumber)}
                  onValueChange={(v) => setCieNumber(Number(v) as 1 | 2 | 3)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">CIE 1</SelectItem>
                    <SelectItem value="2">CIE 2</SelectItem>
                    <SelectItem value="3">CIE 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subjects</Label>
                <Select
                  value={subjectMode}
                  onValueChange={(v) => setSubjectMode(v as "all" | "custom")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    <SelectItem value="custom">Custom subjects</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {subjectMode === "custom" && (
                <div className="space-y-2">
                  <Label>Select Subjects</Label>
                  <MultiSelect
                    options={courses.map((c) => ({
                      value: c.id,
                      label: `${c.code} - ${c.name}`,
                    }))}
                    selected={subjectIds}
                    onChange={setSubjectIds}
                    placeholder="Select subjects"
                  />
                </div>
              )}
            </div>
          )}

          {(activeCategory === "BALANCE_FEE" ||
            activeCategory === "ANNUAL_FEE") && (
            <div className="max-w-sm space-y-2">
              <Label>Payment Deadline</Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          )}

          {activeCategory === "PARENT_TEACHER_MEETING" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Meeting Date</Label>
                <Input
                  type="date"
                  value={ptmDate}
                  onChange={(e) => setPtmDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Meeting Time</Label>
                <Input
                  type="time"
                  value={ptmTime}
                  onChange={(e) => setPtmTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Venue</Label>
                <Input
                  placeholder="e.g. Main Auditorium"
                  value={ptmVenu}
                  onChange={(e) => setPtmVenu(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleLoad} disabled={previewMutation.isPending}>
              {previewMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Load Recipients
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {preview.recipients.length} recipient(s)
              {preview.skippedCount > 0 && (
                <> &middot; {preview.skippedCount} skipped (no phone)</>
              )}
            </span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="mr-2 size-4" /> Preview Messages
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={toggleAll}
              disabled={preview.recipients.length === 0}
            >
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setChannel("WHATSAPP");
                setConfirmOpen(true);
              }}
              disabled={selectedCount === 0 || sendMutation.isPending}
            >
              <Send className="mr-2 size-4" />
              Send WhatsApp ({selectedCount})
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setChannel("SMS");
                setConfirmOpen(true);
              }}
              disabled={selectedCount === 0 || sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Send SMS ({selectedCount})
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="size-4"
                    />
                  </TableHead>
                  <TableHead>USN</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Section</TableHead>
                  {activeCategory === "CIE" && <TableHead>Subject</TableHead>}
                  <TableHead>Recipient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Template</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.recipients.map((recipient, index) => (
                  <TableRow
                    key={`${recipient.studentId}-${recipient.courseId ?? "x"}-${recipient.recipientType}-${index}`}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(recipient.studentId)}
                        onChange={() => toggleStudent(recipient.studentId)}
                        className="size-4"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {recipient.usn}
                    </TableCell>
                    <TableCell>{recipient.studentName}</TableCell>
                    <TableCell>{recipient.sectionName}</TableCell>
                    {activeCategory === "CIE" && (
                      <TableCell>
                        {recipient.courseCode
                          ? `${recipient.courseCode}${recipient.courseName ? ` - ${recipient.courseName}` : ""}`
                          : "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant="outline">
                        {RECIPIENT_LABELS[recipient.recipientType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {recipient.to}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-xs">
                      {recipient.templateName}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message Preview</DialogTitle>
            <DialogDescription>
              Sample rendered messages (
              {activeCategory ? CATEGORY_LABELS[activeCategory] : ""})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {previewSamples.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No recipients loaded.
              </p>
            ) : (
              previewSamples.map((recipient, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <Badge variant="outline">
                      {RECIPIENT_LABELS[recipient.recipientType]}
                    </Badge>
                    <span className="text-muted-foreground">
                      {recipient.studentName} ({recipient.usn})
                      {recipient.courseCode ? ` - ${recipient.courseCode}` : ""}
                    </span>
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap text-sm">
                    {recipient.messageText}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Send</DialogTitle>
            <DialogDescription>
              This will send{" "}
              <span className="text-foreground font-semibold">
                {selectedCount} message group(s)
              </span>{" "}
              to{" "}
              <span className="text-foreground font-semibold">
                {preview?.recipients.filter((r) =>
                  selectedStudentIds.has(r.studentId)
                ).length ?? 0}
              </span>{" "}
              recipient(s) as real{" "}
              <span className="text-foreground font-semibold">{channel}</span>{" "}
              messages. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSend}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Complete</DialogTitle>
            <DialogDescription>
              Campaign logged for reporting.
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Total</p>
                  <p className="text-xl font-semibold">{result.total}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/30 p-3">
                  <p className="text-muted-foreground text-xs">Success</p>
                  <p className="text-xl font-semibold text-emerald-500">
                    {result.success}
                  </p>
                </div>
                <div className="rounded-lg border border-red-500/30 p-3">
                  <p className="text-muted-foreground text-xs">Failed</p>
                  <p className="text-xl font-semibold text-red-500">
                    {result.failure}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Skipped</p>
                  <p className="text-xl font-semibold">{result.skipped}</p>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Campaign ID:{" "}
                <code className="text-foreground">{result.campaignId}</code>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
