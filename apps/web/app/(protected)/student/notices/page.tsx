"use client";

import { useStudentNotices } from "@/modules/notices/use-notices";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";

export default function StudentNoticesPage() {
  const notices = useStudentNotices();
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Notices</h1>
      {notices.data?.map((notice) => (
        <Card key={notice.id}>
          <CardHeader>
            <CardTitle>{notice.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap text-sm">
              {notice.content}
            </p>
          </CardContent>
        </Card>
      ))}
      {!notices.data?.length && (
        <p className="text-muted-foreground text-sm">No notices available.</p>
      )}
    </div>
  );
}
