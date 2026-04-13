import { Badge } from "@webcampus/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@webcampus/ui/components/card";
import { Book, Calendar, Clock } from "lucide-react";

type SessionPreviewProps = {
  preview: {
    course: string;
    section: string;
    date: string;
    time: string;
  } | null;
};

export const SessionPreview = ({ preview }: SessionPreviewProps) => {
  if (!preview) {
    return null;
  }

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Session Preview</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-sm">
          <Book className="text-muted-foreground h-4 w-4" />
          <span>{preview.course}</span>
        </div>
        <Badge variant="secondary" className="w-fit">
          Section {preview.section}
        </Badge>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="text-muted-foreground h-4 w-4" />
          <span>{preview.date}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="text-muted-foreground h-4 w-4" />
          <span>{preview.time}</span>
        </div>
      </CardContent>
    </Card>
  );
};
