"use client";

import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import {
  useUpsertVerificationSetting,
  useVerificationLogs,
  useVerificationSettings,
} from "@/modules/admin/verification/use-verification-settings";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@webcampus/ui/components/select";
import { Switch } from "@webcampus/ui/components/switch";
import { Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function toDatetimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoString(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export const AdminVerificationSettingsView = () => {
  const { data: termsData } = useAcademicTerms();
  const terms = termsData ?? [];
  const { data: settings = [], isLoading } = useVerificationSettings();
  const saveMutation = useUpsertVerificationSetting();

  const [selectedTermId, setSelectedTermId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [windowStartAt, setWindowStartAt] = useState("");
  const [windowEndAt, setWindowEndAt] = useState("");

  const selectedSetting = useMemo(
    () => settings.find((s) => s.academicTermId === selectedTermId) ?? null,
    [settings, selectedTermId]
  );

  useEffect(() => {
    if (selectedSetting) {
      setEnabled(selectedSetting.enabled);
      setWindowStartAt(toDatetimeLocal(selectedSetting.windowStartAt));
      setWindowEndAt(toDatetimeLocal(selectedSetting.windowEndAt));
    } else {
      setEnabled(false);
      setWindowStartAt("");
      setWindowEndAt("");
    }
  }, [selectedSetting]);

  const handleSave = () => {
    if (!selectedTermId) return;
    saveMutation.mutate({
      academicTermId: selectedTermId,
      enabled,
      windowStartAt: toIsoString(windowStartAt),
      windowEndAt: toIsoString(windowEndAt),
    });
  };

  const { data: logsData, isLoading: logsLoading } = useVerificationLogs({
    limit: 20,
    academicTermId: selectedTermId || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Hall Ticket Verification Settings
        </h2>
        <p className="text-muted-foreground text-sm">
          Enable QR verification per academic term and control the active
          window.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-full max-w-md space-y-2">
            <Label htmlFor="setting-term">Academic term</Label>
            <Select value={selectedTermId} onValueChange={setSelectedTermId}>
              <SelectTrigger id="setting-term">
                <SelectValue placeholder="Select a term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.type.toUpperCase()} {t.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading settings...</p>
          ) : selectedTermId ? (
            <>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Enable QR verification</p>
                  <p className="text-muted-foreground text-xs">
                    Faculty, HODs, and Admins can scan hall tickets to verify
                    students while this is on.
                  </p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="window-start">Window start</Label>
                  <Input
                    id="window-start"
                    type="datetime-local"
                    value={windowStartAt}
                    onChange={(e) => setWindowStartAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="window-end">Window end</Label>
                  <Input
                    id="window-end"
                    type="datetime-local"
                    value={windowEndAt}
                    onChange={(e) => setWindowEndAt(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Leave the window fields empty for an always-on window (toggle
                still applies). Set both to restrict scanning to an exam period.
              </p>

              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Save Settings
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Select an academic term to configure verification.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Verification Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <p className="text-muted-foreground text-sm">Loading logs...</p>
          ) : !logsData || logsData.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No verification activity yet.
            </p>
          ) : (
            <ul className="divide-y">
              {logsData.items.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between gap-2 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {log.student?.usn ?? log.studentId}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(log.createdAt).toLocaleString()} &middot;{" "}
                      {log.verifiedByRole ?? "unknown"}
                    </p>
                  </div>
                  <Badge
                    variant={log.result === "VALID" ? "default" : "destructive"}
                    className={
                      log.result === "VALID"
                        ? "bg-emerald-500 text-white dark:bg-emerald-500/20 dark:text-emerald-400"
                        : ""
                    }
                  >
                    {log.result.replace(/_/g, " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
