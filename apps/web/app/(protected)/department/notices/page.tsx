"use client";

import { NoticeForm } from "@/modules/notices/notice-form";
import {
  useDepartmentNotices,
  useNoticeMutations,
} from "@/modules/notices/use-notices";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { useState } from "react";

export default function DepartmentNoticesPage() {
  const notices = useDepartmentNotices();
  const mutations = useNoticeMutations();
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Department notices</h1>
          <p className="text-muted-foreground text-sm">
            Create notices and share them with students, faculty, or both.
          </p>
        </div>
        <Button onClick={() => setShowForm((value) => !value)}>
          Create notice
        </Button>
      </div>
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New notice</CardTitle>
          </CardHeader>
          <CardContent>
            <NoticeForm
              onCancel={() => setShowForm(false)}
              onSubmit={(input) => {
                mutations.create.mutate(input);
                setShowForm(false);
              }}
            />
          </CardContent>
        </Card>
      )}
      <div className="space-y-3">
        {notices.data?.map((notice) => (
          <Card key={notice.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{notice.title}</CardTitle>
                <span className="text-muted-foreground text-xs">
                  {notice.audience} · {notice.status}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">
                {notice.content}
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    mutations.setStatus.mutate({
                      id: notice.id,
                      status:
                        notice.status === "PUBLISHED"
                          ? "ARCHIVED"
                          : "PUBLISHED",
                    })
                  }
                >
                  {notice.status === "PUBLISHED" ? "Archive" : "Publish"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => mutations.remove.mutate(notice.id)}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!notices.data?.length && (
          <p className="text-muted-foreground text-sm">
            No notices created yet.
          </p>
        )}
      </div>
    </div>
  );
}
