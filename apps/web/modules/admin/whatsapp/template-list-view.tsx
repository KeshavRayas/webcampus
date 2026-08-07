"use client";

import { Badge } from "@webcampus/ui/components/badge";
import { Button } from "@webcampus/ui/components/button";
import { Card, CardContent } from "@webcampus/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import {
  CATEGORY_LABELS,
  RECIPIENT_LABELS,
  TemplateForm,
} from "./template-form";
import type { MessageTemplate, TemplateFormValues } from "./types";
import {
  useCreateTemplate,
  useDeleteTemplate,
  useMessageTemplates,
  useUpdateTemplate,
} from "./use-templates";

const categoryBadge: Record<string, string> = {
  CIE: "bg-blue-500 text-white dark:bg-blue-500/20 dark:text-blue-400",
  BALANCE_FEE:
    "bg-amber-500 text-white dark:bg-amber-500/20 dark:text-amber-400",
  ANNUAL_FEE:
    "bg-orange-500 text-white dark:bg-orange-500/20 dark:text-orange-400",
  PARENT_TEACHER_MEETING:
    "bg-purple-500 text-white dark:bg-purple-500/20 dark:text-purple-400",
};

export const TemplateListView = () => {
  const { data: templates = [], isLoading } = useMessageTemplates({
    includeInactive: true,
  });
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);

  const handleSubmit = async (data: TemplateFormValues) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const handleDelete = async (template: MessageTemplate) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(template.id);
    } catch {
      toast.error("Failed to delete template");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            WhatsApp Templates
          </h2>
          <p className="text-muted-foreground text-sm">
            Store message templates with their external template id and variable
            mapping.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 rounded-lg border p-12 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            No templates yet. Create one to start sending WhatsApp messages.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>External Template ID</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={categoryBadge[template.category]}
                    >
                      {CATEGORY_LABELS[template.category]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {RECIPIENT_LABELS[template.recipientType]}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {template.externalTemplateId}
                  </TableCell>
                  <TableCell>{template.variables.length}</TableCell>
                  <TableCell>
                    {template.isActive ? (
                      <Badge className="bg-emerald-500 text-white dark:bg-emerald-500/20 dark:text-emerald-400">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit template"
                        onClick={() => {
                          setEditing(template);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete template"
                        onClick={() => handleDelete(template)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TemplateForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};
