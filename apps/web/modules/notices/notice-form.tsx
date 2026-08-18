"use client";

import { Button } from "@webcampus/ui/components/button";
import { Input } from "@webcampus/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { useState } from "react";
import type { Notice, NoticeInput } from "./notice-types";

export function NoticeForm({
  notice,
  onSubmit,
  onCancel,
}: {
  notice?: Notice;
  onSubmit: (input: NoticeInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(notice?.title ?? "");
  const [content, setContent] = useState(notice?.content ?? "");
  const [audience, setAudience] = useState<NoticeInput["audience"]>(
    notice?.audience ?? "BOTH"
  );
  const [priority, setPriority] = useState<NoticeInput["priority"]>(
    notice?.priority ?? "NORMAL"
  );
  const [expiresAt, setExpiresAt] = useState(
    notice?.expiresAt?.slice(0, 10) ?? ""
  );
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          title,
          content,
          audience,
          priority,
          expiresAt: expiresAt
            ? new Date(`${expiresAt}T23:59:59`).toISOString()
            : null,
        });
      }}
    >
      <Input
        placeholder="Notice title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <textarea
        className="border-input bg-background min-h-32 w-full rounded-md border px-3 py-2 text-sm"
        placeholder="Notice content"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        required
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          value={audience}
          onValueChange={(value) =>
            setAudience(value as NoticeInput["audience"])
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Audience" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STUDENTS">Students</SelectItem>
            <SelectItem value="FACULTY">Faculty</SelectItem>
            <SelectItem value="BOTH">Students and faculty</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={priority}
          onValueChange={(value) =>
            setPriority(value as NoticeInput["priority"])
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save draft</Button>
      </div>
    </form>
  );
}
