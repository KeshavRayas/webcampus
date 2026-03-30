"use client";

import { useMemo, useState } from "react";
import { publicationCategoryOptions, FacultyProfilePayload } from "./use-faculty-profile";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@webcampus/ui/components/table";

type PublicationPayload = {
  category: "JOURNAL" | "CONFERENCE" | "BOOK_CHAPTER_OR_BOOK" | "CASE_STUDY" | "PATENT";
  publishedDate: string;
  authors: string;
  publicationDetails: string;
  weblink: string;
};

const initialPublication: PublicationPayload = {
  category: "JOURNAL",
  publishedDate: "",
  authors: "",
  publicationDetails: "",
  weblink: "",
};

const formatCategory = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");

export const PublicationsList = ({
  profile,
  onCreate,
  onUpdate,
  onDelete,
  isWorking,
}: {
  profile: FacultyProfilePayload;
  onCreate: (payload: PublicationPayload) => void;
  onUpdate: (id: string, payload: PublicationPayload) => void;
  onDelete: (id: string) => void;
  isWorking: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PublicationPayload>(initialPublication);

  const title = useMemo(
    () => (editingId ? "Update Publication" : "Add Publication"),
    [editingId]
  );

  const resetForm = () => {
    setEditingId(null);
    setFormData(initialPublication);
  };

  return (
    <section className="bg-card rounded-xl border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="border-b pb-2 text-lg font-semibold">Publications</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
          disabled={isWorking}
        >
          Update
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] w-[95vw] sm:max-w-xl md:max-w-3xl lg:max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: PublicationPayload["category"]) =>
                    setFormData((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {publicationCategoryOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {formatCategory(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Published Date</Label>
                <Input
                  type="date"
                  value={formData.publishedDate}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, publishedDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Authors</Label>
                <Input
                  value={formData.authors}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, authors: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Publication Details</Label>
              <Input
                value={formData.publicationDetails}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    publicationDetails: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Weblink</Label>
              <Input
                value={formData.weblink}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, weblink: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={isWorking}
              onClick={() => {
                if (editingId) {
                  onUpdate(editingId, formData);
                } else {
                  onCreate(formData);
                }
                setOpen(false);
              }}
            >
              {isWorking ? "Saving..." : editingId ? "Update" : "Add"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Publication Details</TableHead>
              <TableHead className="w-[140px]">Published Date</TableHead>
              <TableHead className="w-[120px]">Weblink</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profile.publications.length ? (
              profile.publications.map((publication) => (
                <TableRow key={publication.id}>
                  <TableCell>{formatCategory(publication.category)}</TableCell>
                  <TableCell>{publication.publicationDetails}</TableCell>
                  <TableCell>
                    {new Date(publication.publishedDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {publication.weblink ? (
                      <a
                        href={publication.weblink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        Weblink
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(publication.id);
                          setFormData({
                            category: publication.category,
                            publishedDate: new Date(publication.publishedDate)
                              .toISOString()
                              .slice(0, 10),
                            authors: publication.authors,
                            publicationDetails: publication.publicationDetails,
                            weblink: publication.weblink || "",
                          });
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(publication.id)}
                        disabled={isWorking}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  No publications added yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
};
