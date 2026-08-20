"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useAdmissionConstants } from "@/lib/use-admission-constants";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@webcampus/ui/components/alert-dialog";
import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Input } from "@webcampus/ui/components/input";
import { Label } from "@webcampus/ui/components/label";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

type ModeDraft = {
  quotas: string[];
  categoriesClaimed: string[];
  categoriesAllotted: string[];
};

const EMPTY_DRAFT: ModeDraft = {
  quotas: [],
  categoriesClaimed: [],
  categoriesAllotted: [],
};

function ReferenceListEditor({
  title,
  description,
  values,
  placeholder,
  onAdd,
  onRemove,
}: {
  title: string;
  description?: string;
  values: string[];
  placeholder?: string;
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
}) {
  const [input, setInput] = useState("");

  const submit = () => {
    const value = input.trim();
    if (!value) return;
    if (values.some((existing) => existing === value)) {
      toast.error(`${value} is already present.`);
      return;
    }
    setInput("");
    onAdd(value);
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Label>{title}</Label>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {values.length === 0 ? (
          <span className="text-muted-foreground text-sm">None</span>
        ) : (
          values.map((value, index) => (
            <Badge
              key={`${value}-${index}`}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => onRemove(index)}
                className="hover:bg-secondary-foreground/10 rounded-sm p-0.5 transition-colors"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder ?? `Add ${title.toLowerCase()}`}
          className="max-w-xs"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={submit}>
          Add
        </Button>
      </div>
    </div>
  );
}

function NewModeForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<ModeDraft>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" /> Add New Mode
      </Button>
    );
  }

  const updateList = (key: keyof ModeDraft) => (next: string[]) =>
    setDraft((prev) => ({ ...prev, [key]: next }));

  const handleCreate = async () => {
    const modeOfAdmission = name.trim();
    if (!modeOfAdmission) {
      toast.error("Mode of admission name is required.");
      return;
    }
    if (draft.quotas.length === 0) {
      toast.error("Add at least one quota.");
      return;
    }
    if (draft.categoriesClaimed.length === 0) {
      toast.error("Add at least one category claimed.");
      return;
    }
    if (draft.categoriesAllotted.length === 0) {
      toast.error("Add at least one category allotted.");
      return;
    }

    setCreating(true);
    try {
      await apiClient.post("/admission/constants/modes", {
        modeOfAdmission,
        ...draft,
      });
      toast.success("Admission mode created successfully.");
      setName("");
      setDraft(EMPTY_DRAFT);
      setOpen(false);
      await onCreated();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create admission mode"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1 space-y-1.5">
          <Label>New mode of admission</Label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. CET, COMED-K, Management"
            className="max-w-md"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={creating}
            onClick={() => {
              setOpen(false);
              setName("");
              setDraft(EMPTY_DRAFT);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={creating}
            onClick={handleCreate}
          >
            {creating ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Create Mode
          </Button>
        </div>
      </div>
      <ReferenceListEditor
        title="Quotas"
        description="Quota categories offered under this mode"
        values={draft.quotas}
        placeholder="e.g. General, SC, ST, OBC"
        onAdd={(value) => updateList("quotas")([...draft.quotas, value])}
        onRemove={(index) =>
          updateList("quotas")(draft.quotas.filter((_, i) => i !== index))
        }
      />
      <ReferenceListEditor
        title="Categories claimed"
        description="Categories students can claim on admission"
        values={draft.categoriesClaimed}
        placeholder="e.g. GM, SC, ST, OBC"
        onAdd={(value) =>
          updateList("categoriesClaimed")([...draft.categoriesClaimed, value])
        }
        onRemove={(index) =>
          updateList("categoriesClaimed")(
            draft.categoriesClaimed.filter((_, i) => i !== index)
          )
        }
      />
      <ReferenceListEditor
        title="Categories allotted"
        description="Categories seats can be allotted under"
        values={draft.categoriesAllotted}
        placeholder="e.g. GM, SC, ST, OBC"
        onAdd={(value) =>
          updateList("categoriesAllotted")([...draft.categoriesAllotted, value])
        }
        onRemove={(index) =>
          updateList("categoriesAllotted")(
            draft.categoriesAllotted.filter((_, i) => i !== index)
          )
        }
      />
    </div>
  );
}

export function AdmissionSetupView() {
  const {
    data: options,
    isLoading,
    isError,
    refetch,
  } = useAdmissionConstants();
  const queryClient = useQueryClient();
  const [activeMode, setActiveMode] = useState<string | null>(null);

  const modes = options?.modes ?? [];

  const initialDraft: ModeDraft = useMemo(() => {
    if (!options || !activeMode) return EMPTY_DRAFT;
    return {
      quotas: options.quotas[activeMode] ?? [],
      categoriesClaimed: options.categoriesClaimed[activeMode] ?? [],
      categoriesAllotted: options.categoriesAllotted[activeMode] ?? [],
    };
  }, [options, activeMode]);

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["admission-constants"],
    });
  };

  const handleDeleted = (mode: string) => {
    const remaining = modes.filter((item) => item !== mode);
    setActiveMode(remaining[0] ?? null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="flex items-center justify-between p-6">
        <p className="text-muted-foreground text-sm">
          Failed to load admission setup. Please try again.
        </p>
        <Button type="button" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="admission-setup flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Admission Setup</h1>
        <p className="text-muted-foreground text-sm">
          Manage admission modes, quotas, and categories claimed / allotted.
          Changes update the dropdowns used across admission forms.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modes of Admission</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {modes.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No modes defined yet.
              </p>
            ) : (
              modes.map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={activeMode === mode ? "secondary" : "ghost"}
                  className="justify-start"
                  onClick={() => setActiveMode(mode)}
                >
                  {mode}
                </Button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {activeMode ? (
            <ModeEditor
              key={activeMode}
              mode={activeMode}
              initial={initialDraft}
              onSaved={refresh}
              onDeleted={() => handleDeleted(activeMode)}
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create a New Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <NewModeForm onCreated={refresh} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ModeEditor({
  mode,
  initial,
  onSaved,
  onDeleted,
}: {
  mode: string;
  initial: ModeDraft;
  onSaved: () => Promise<void>;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState<ModeDraft>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const updateList = (key: keyof ModeDraft) => (next: string[]) =>
    setDraft((prev) => ({ ...prev, [key]: next }));

  const handleSave = async () => {
    if (draft.quotas.length === 0) {
      toast.error("Add at least one quota.");
      return;
    }
    if (draft.categoriesClaimed.length === 0) {
      toast.error("Add at least one category claimed.");
      return;
    }
    if (draft.categoriesAllotted.length === 0) {
      toast.error("Add at least one category allotted.");
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.put(
        `/admission/constants/modes/${encodeURIComponent(mode)}`,
        draft
      );
      toast.success(`Updated ${mode}`);
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update admission mode"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiClient.delete(
        `/admission/constants/modes/${encodeURIComponent(mode)}`
      );
      toast.success(`Deleted ${mode}`);
      await onSaved();
      onDeleted();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete admission mode"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">{mode}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting || isSaving}
              onClick={() => setConfirmOpen(true)}
            >
              {isDeleting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving || isDeleting}
              onClick={handleSave}
            >
              {isSaving ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ReferenceListEditor
            title="Quotas"
            description="Quota categories offered under this mode (e.g. General, SC, ST, OBC)"
            values={draft.quotas}
            placeholder="e.g. General, SC, ST"
            onAdd={(value) => updateList("quotas")([...draft.quotas, value])}
            onRemove={(index) =>
              updateList("quotas")(draft.quotas.filter((_, i) => i !== index))
            }
          />
          <ReferenceListEditor
            title="Categories claimed"
            description="Categories students can claim on admission"
            values={draft.categoriesClaimed}
            placeholder="e.g. GM, SC, ST, OBC"
            onAdd={(value) =>
              updateList("categoriesClaimed")([
                ...draft.categoriesClaimed,
                value,
              ])
            }
            onRemove={(index) =>
              updateList("categoriesClaimed")(
                draft.categoriesClaimed.filter((_, i) => i !== index)
              )
            }
          />
          <ReferenceListEditor
            title="Categories allotted"
            description="Categories seats can be allotted under"
            values={draft.categoriesAllotted}
            placeholder="e.g. GM, SC, ST, OBC"
            onAdd={(value) =>
              updateList("categoriesAllotted")([
                ...draft.categoriesAllotted,
                value,
              ])
            }
            onRemove={(index) =>
              updateList("categoriesAllotted")(
                draft.categoriesAllotted.filter((_, i) => i !== index)
              )
            }
          />
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete mode "{mode}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong>{mode}</strong> and all of its quota /
              category mappings. Admissions already created are not affected,
              but the option will disappear from admission forms. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                setConfirmOpen(false);
                void handleDelete();
              }}
            >
              Delete Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
