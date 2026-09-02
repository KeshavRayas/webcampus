"use client";

import { apiClient } from "@/lib/api-client";
import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { useSemestersByTerm } from "@/modules/admin/semester/use-semester-config";
import { dayjs } from "@webcampus/common/dayjs";
import { Button } from "@webcampus/ui/components/button";
import { Calendar } from "@webcampus/ui/components/calendar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { ConfirmDialog } from "@webcampus/ui/components/confirm-dialog";
import { Input } from "@webcampus/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@webcampus/ui/components/popover";
import { isAxiosError } from "axios";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

type Preset = {
  id: string;
  name: string;
  description?: string;
  questions: Array<{ questionNumber: number; questionText: string }>;
};

type Semester = {
  id: string;
  programType: "UG" | "PG";
  semesterNumber: number;
};

type Question = { questionNumber: number; questionText: string };

type RoundState = {
  id: string;
  roundNumber: number;
  name: string;
  startsAt: string;
  endsAt: string;
  isEnabled: boolean;
};

const emptyRounds = (): RoundState[] => [
  {
    id: "",
    roundNumber: 1,
    name: "Round 1",
    startsAt: "",
    endsAt: "",
    isEnabled: false,
  },
];

const errorMessage = (error: unknown, fallback: string) =>
  isAxiosError(error)
    ? (error.response?.data?.message ?? fallback)
    : error instanceof Error
      ? error.message
      : fallback;

function DateTimePickerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const datePart = value.slice(0, 10);
  const timePart = value.length > 10 ? value.slice(11, 16) : "";
  const selectedDate = datePart ? dayjs(datePart).toDate() : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="border-input focus-within:ring-ring text-muted-foreground flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-within:ring-1"
        >
          <span>
            {value
              ? dayjs(value).format("MMM D, YYYY h:mm A")
              : "Select date & time"}
          </span>
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="space-y-3 p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) =>
              onChange(
                date
                  ? `${dayjs(date).format("YYYY-MM-DD")}T${timePart || "00:00"}`
                  : ""
              )
            }
            captionLayout="dropdown"
            fromYear={new Date().getFullYear() - 1}
            toYear={new Date().getFullYear() + 2}
          />
          <div className="flex items-center gap-2">
            <ClockIcon className="text-muted-foreground h-4 w-4" />
            <input
              type="time"
              className="border-input focus-within:ring-ring flex h-9 w-full items-center rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-within:ring-1"
              value={timePart}
              onChange={(event) =>
                onChange(datePart ? `${datePart}T${event.target.value}` : "")
              }
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FeedbackConfigView() {
  const { data: loadedTerms } = useAcademicTerms();
  const terms = loadedTerms ?? [];
  const [academicTermId, setAcademicTermId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const { data: loadedSemesters } = useSemestersByTerm(academicTermId);
  const semesters = (loadedSemesters ?? []) as Semester[];
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [rounds, setRounds] = useState<RoundState[]>(emptyRounds());
  const [locked, setLocked] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  const loadTermConfig = useCallback((termId: string, semester: string) => {
    setLoadingConfig(true);
    void apiClient
      .get(`/admin/feedback/configuration/term/${termId}/semester/${semester}`)
      .then((response) => {
        const config = response.data.data;
        setPresetId(config?.presetId ?? "");
        setQuestions(
          config?.questions?.length
            ? config.questions.map(
                (question: {
                  questionNumber: number;
                  questionText: string;
                }) => ({
                  questionNumber: question.questionNumber,
                  questionText: question.questionText,
                })
              )
            : []
        );
        const hasRounds = config?.rounds?.length > 0;
        setLocked(Boolean(config?.isLocked) || hasRounds);
        if (hasRounds) {
          setRounds(
            (
              config.rounds as Array<{
                id: string;
                roundNumber: number;
                name: string;
                startsAt: string;
                endsAt: string;
                isEnabled: boolean;
              }>
            ).map((saved) => ({
              id: saved.id,
              roundNumber: saved.roundNumber,
              name: saved.name || `Round ${saved.roundNumber}`,
              startsAt: saved.startsAt.slice(0, 16),
              endsAt: saved.endsAt.slice(0, 16),
              isEnabled: saved.isEnabled,
            }))
          );
        } else {
          setRounds(emptyRounds());
        }
      })
      .catch(() => {
        setPresetId("");
        setQuestions([]);
        setRounds(emptyRounds());
        setLocked(false);
      })
      .finally(() => setLoadingConfig(false));
  }, []);

  useEffect(() => {
    void apiClient
      .get(`/admin/feedback/presets`)
      .then((response) => setPresets(response.data.data ?? []))
      .catch(() => setPresets([]));
  }, []);

  useEffect(() => {
    if (!academicTermId || !semesterId) {
      setPresetId("");
      setQuestions([]);
      setRounds(emptyRounds());
      setLocked(false);
      return;
    }
    loadTermConfig(academicTermId, semesterId);
  }, [academicTermId, semesterId, loadTermConfig]);

  const selectedPreset = presets.find((preset) => preset.id === presetId);
  const displayQuestions =
    questions.length > 0 ? questions : (selectedPreset?.questions ?? []);

  const saveQuestionSet = async () => {
    if (!academicTermId || !semesterId || !presetId) return;
    try {
      await apiClient.post(`/admin/feedback/configuration/term`, {
        academicTermId,
        semesterId,
        presetId,
      });
      toast.success("Feedback question set saved");
      loadTermConfig(academicTermId, semesterId);
    } catch (error) {
      toast.error(errorMessage(error, "Could not save question set"));
    }
  };

  const saveRounds = async () => {
    if (!academicTermId || !semesterId) return;
    try {
      for (const round of rounds) {
        if (!round.startsAt || !round.endsAt)
          throw new Error(`Set dates for round ${round.roundNumber}`);
        const payload = {
          academicTermId,
          semesterId,
          roundNumber: round.roundNumber,
          name: round.name || `Round ${round.roundNumber}`,
          startsAt: new Date(round.startsAt).toISOString(),
          endsAt: new Date(round.endsAt).toISOString(),
          isEnabled: round.isEnabled,
        };
        if (round.id) {
          await apiClient.patch(`/admin/feedback/rounds/${round.id}`, payload);
        } else {
          const response = await apiClient.post(
            `/admin/feedback/rounds`,
            payload
          );
          setRounds((current) =>
            current.map((item) =>
              item.roundNumber === round.roundNumber
                ? { ...item, id: response.data.data.id }
                : item
            )
          );
        }
      }
      toast.success("Feedback rounds saved");
      loadTermConfig(academicTermId, semesterId);
    } catch (error) {
      toast.error(errorMessage(error, "Could not save rounds"));
    }
  };

  const updateRound = async (
    round: RoundState,
    action: "enable" | "disable"
  ) => {
    if (!round.id) return;
    try {
      await apiClient.post(`/admin/feedback/rounds/${round.id}/${action}`, {});
      setRounds((current) =>
        current.map((item) =>
          item.id === round.id
            ? { ...item, isEnabled: action === "enable" }
            : item
        )
      );
      toast.success(`Round ${round.roundNumber} ${action}d`);
    } catch (error) {
      toast.error(errorMessage(error, `Could not ${action} round`));
    }
  };

  const addRound = () => {
    const nextNumber =
      rounds.reduce((max, round) => Math.max(max, round.roundNumber), 0) + 1;
    setRounds((current) => [
      ...current,
      {
        id: "",
        roundNumber: nextNumber,
        name: `Round ${nextNumber}`,
        startsAt: "",
        endsAt: "",
        isEnabled: false,
      },
    ]);
  };

  const [pendingDeleteRound, setPendingDeleteRound] =
    useState<RoundState | null>(null);

  const confirmRemoveRound = async () => {
    const round = pendingDeleteRound;
    if (!round) return;
    if (round.id) {
      try {
        await apiClient.delete(`/admin/feedback/rounds/${round.id}`);
        toast.success("Feedback round deleted");
      } catch (error) {
        toast.error(errorMessage(error, "Could not delete round"));
        return;
      } finally {
        setPendingDeleteRound(null);
      }
    } else {
      setPendingDeleteRound(null);
    }
    setRounds((current) =>
      current.filter((item) => item.roundNumber !== round.roundNumber)
    );
  };

  const removeRound = (round: RoundState) => {
    setPendingDeleteRound(round);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Feedback Configuration</h1>
        <p className="text-muted-foreground text-sm">
          Select an academic term and semester, choose a question preset, add
          round date ranges with custom names, save, then enable each round when
          ready. Each semester is configured independently.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Academic Term</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={academicTermId}
            onChange={(event) => {
              setAcademicTermId(event.target.value);
              setSemesterId("");
            }}
          >
            <option value="">Select academic term</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.type.toUpperCase()} {term.year}
                {term.isCurrent ? " (Current)" : ""}
              </option>
            ))}
          </select>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={semesterId}
            onChange={(event) => setSemesterId(event.target.value)}
            disabled={!academicTermId}
          >
            <option value="">Select semester</option>
            {semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.programType.toUpperCase()} - Semester{" "}
                {semester.semesterNumber}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Question Set</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={presetId}
            onChange={(event) => {
              setPresetId(event.target.value);
              setQuestions([]);
            }}
            disabled={!academicTermId || !semesterId || locked}
          >
            <option value="">Select question preset</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          {locked && (
            <p className="text-muted-foreground text-sm">
              Question set is locked because feedback rounds have been
              configured for this semester.
            </p>
          )}
          {loadingConfig ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : displayQuestions.length > 0 ? (
            <ol className="space-y-2">
              {displayQuestions.map((question) => (
                <li
                  key={question.questionNumber}
                  className="border-input text-sm"
                >
                  {question.questionNumber}. {question.questionText}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground text-sm">
              Select a preset to preview its ten questions.
            </p>
          )}
          <Button
            onClick={saveQuestionSet}
            disabled={!academicTermId || !semesterId || !presetId || locked}
          >
            Save question set
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Feedback Rounds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rounds.map((round, index) => {
            const active = round.isEnabled;
            const updateField = (field: Partial<RoundState>) =>
              setRounds((current) =>
                current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, ...field } : item
                )
              );
            return (
              <div
                key={round.roundNumber}
                className="border-input space-y-3 rounded-md border p-3"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    className="flex-1"
                    placeholder="Round name"
                    value={round.name}
                    onChange={(event) =>
                      updateField({ name: event.target.value })
                    }
                  />
                  <span className="text-muted-foreground self-center text-sm">
                    {active ? "Active" : "Inactive"}
                  </span>
                  <div className="flex gap-2 self-center">
                    {round.id ? (
                      <Button
                        variant="outline"
                        onClick={() =>
                          updateRound(round, active ? "disable" : "enable")
                        }
                      >
                        {active ? "Disable" : "Enable"}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground self-center text-sm">
                        Save first
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => void removeRound(round)}
                      disabled={rounds.length === 1}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted-foreground text-xs font-semibold">
                      Starts at
                    </label>
                    <DateTimePickerField
                      value={round.startsAt}
                      onChange={(value) => updateField({ startsAt: value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted-foreground text-xs font-semibold">
                      Ends at
                    </label>
                    <DateTimePickerField
                      value={round.endsAt}
                      onChange={(value) => updateField({ endsAt: value })}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Button
              onClick={addRound}
              disabled={!academicTermId || !semesterId}
            >
              Add round
            </Button>
            <Button
              onClick={saveRounds}
              disabled={!academicTermId || !semesterId}
            >
              Save rounds
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!pendingDeleteRound}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteRound(null);
        }}
        title={
          pendingDeleteRound?.id
            ? `Delete ${pendingDeleteRound.name || `Round ${pendingDeleteRound.roundNumber}`}?`
            : `Remove ${pendingDeleteRound?.name || `Round ${pendingDeleteRound?.roundNumber ?? ""}`}?`
        }
        description={
          pendingDeleteRound?.id
            ? "This will remove all responses collected for it. This action cannot be undone."
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => void confirmRemoveRound()}
      />
    </div>
  );
}
