"use client";

import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
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
import { Switch } from "@webcampus/ui/components/switch";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import type {
  MessageCategory,
  MessageRecipientType,
  MessageTemplate,
  TemplateFormValues,
  TemplateVariableInput,
} from "./types";
import { useTemplateFieldSources } from "./use-templates";

export const CATEGORY_LABELS: Record<MessageCategory, string> = {
  CIE: "CIE Marks",
  BALANCE_FEE: "Balance Fee",
  ANNUAL_FEE: "Annual Fee",
  PARENT_TEACHER_MEETING: "Parent-Teacher Meeting",
};

export const RECIPIENT_LABELS: Record<MessageRecipientType, string> = {
  STUDENT: "Student",
  PARENT: "Parent",
};

const categories: MessageCategory[] = [
  "CIE",
  "BALANCE_FEE",
  "ANNUAL_FEE",
  "PARENT_TEACHER_MEETING",
];
const recipientTypes: MessageRecipientType[] = ["STUDENT", "PARENT"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: MessageTemplate | null;
  onSubmit: (data: TemplateFormValues) => Promise<void>;
  submitting?: boolean;
};

const emptyForm: TemplateFormValues = {
  name: "",
  category: "CIE",
  recipientType: "STUDENT",
  externalTemplateId: "",
  messageBody: "",
  isActive: true,
  variables: [],
};

export const TemplateForm = ({
  open,
  onOpenChange,
  editing,
  onSubmit,
  submitting,
}: Props) => {
  const [form, setForm] = useState<TemplateFormValues>(emptyForm);
  const [category, setCategory] = useState<MessageCategory>("CIE");

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name,
          category: editing.category,
          recipientType: editing.recipientType,
          externalTemplateId: editing.externalTemplateId,
          messageBody: editing.messageBody,
          isActive: editing.isActive,
          variables: editing.variables
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((v) => ({
              position: v.position,
              label: v.label,
              fieldSource: v.fieldSource,
            })),
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, editing]);

  useEffect(() => {
    setCategory(form.category);
  }, [form.category]);

  const { data: fieldSources = [] } = useTemplateFieldSources(category);

  const set = <K extends keyof TemplateFormValues>(
    key: K,
    value: TemplateFormValues[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const changeCategory = (value: MessageCategory) => {
    setForm((prev) => ({ ...prev, category: value, variables: [] }));
  };

  const addVariable = () => {
    const nextPosition =
      form.variables.length === 0
        ? 1
        : Math.max(...form.variables.map((v) => v.position)) + 1;
    const source = fieldSources[0];
    const variable: TemplateVariableInput = {
      position: nextPosition,
      label: "",
      fieldSource: source?.value ?? "STUDENT_NAME",
    };
    setForm((prev) => ({ ...prev, variables: [...prev.variables, variable] }));
  };

  const updateVariable = (
    position: number,
    patch: Partial<TemplateVariableInput>
  ) => {
    setForm((prev) => ({
      ...prev,
      variables: prev.variables.map((v) =>
        v.position === position ? { ...v, ...patch } : v
      ),
    }));
  };

  const removeVariable = (position: number) => {
    setForm((prev) => ({
      ...prev,
      variables: prev.variables
        .filter((v) => v.position !== position)
        .map((v, index) => ({ ...v, position: index + 1 })),
    }));
  };

  const tokenHints = useMemo(
    () => fieldSources.map((s) => s.value.toLowerCase()).join(", "),
    [fieldSources]
  );

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.externalTemplateId.trim())
      return toast.error("External template ID is required");
    if (!form.messageBody.trim())
      return toast.error("Message body is required");
    if (form.variables.length === 0)
      return toast.error("At least one variable is required");
    if (form.variables.some((v) => !v.label.trim()))
      return toast.error("Every variable needs a label");
    await onSubmit({
      ...form,
      variables: form.variables
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((v, index) => ({ ...v, position: index + 1 })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Message Template" : "New Message Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. CIE-1 Results (Student)"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>External Template ID</Label>
              <Input
                placeholder="Trustsignal template id"
                value={form.externalTemplateId}
                onChange={(e) => set("externalTemplateId", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) =>
                  changeCategory(value as MessageCategory)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recipient</Label>
              <Select
                value={form.recipientType}
                onValueChange={(value) =>
                  set("recipientType", value as MessageRecipientType)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recipientTypes.map((r) => (
                    <SelectItem key={r} value={r}>
                      {RECIPIENT_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Message Body (preview only)</Label>
            <textarea
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 shadow-xs min-h-28 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              placeholder="e.g. Dear {student_name}, your {subject_name} CIE-1 marks are {cie_marks} out of {cie_max}."
              value={form.messageBody}
              onChange={(e) => set("messageBody", e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Use placeholders like{" "}
              <code className="text-foreground">{"{token}"}</code> with the
              snake_case field name. Available:{" "}
              <code className="text-foreground">{tokenHints}</code>
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Variables (bodyvar order)</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addVariable}
              >
                <Plus className="mr-1 size-4" /> Add Variable
              </Button>
            </div>
            {form.variables.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No variables yet. Add variables in the order they appear in the
                external template body.
              </p>
            ) : (
              <div className="space-y-2">
                {form.variables.map((variable) => (
                  <div
                    key={variable.position}
                    className="flex items-center gap-2"
                  >
                    <span className="text-muted-foreground w-6 text-center font-mono text-xs">
                      {variable.position}
                    </span>
                    <Input
                      placeholder="Variable label"
                      value={variable.label}
                      onChange={(e) =>
                        updateVariable(variable.position, {
                          label: e.target.value,
                        })
                      }
                      className="flex-1"
                    />
                    <Select
                      value={variable.fieldSource}
                      onValueChange={(value) =>
                        updateVariable(variable.position, {
                          fieldSource:
                            value as TemplateVariableInput["fieldSource"],
                        })
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldSources.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeVariable(variable.position)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) => set("isActive", checked)}
            />
            <Label>Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : editing ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
