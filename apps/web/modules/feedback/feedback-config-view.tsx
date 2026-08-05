"use client";

import { useAcademicTerms } from "@/modules/admin/semester/use-academic-term";
import { frontendEnv } from "@webcampus/common/env";
import { Button } from "@webcampus/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@webcampus/ui/components/card";
import { Input } from "@webcampus/ui/components/input";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

type Preset = {
  id: string;
  name: string;
  description?: string;
  questions: Array<{ questionNumber: number; questionText: string }>;
};

type Question = { questionNumber: number; questionText: string };

type RoundState = {
  id: string;
  roundNumber: number;
  startsAt: string;
  endsAt: string;
  isEnabled: boolean;
};

const emptyRounds = (): RoundState[] =>
  [1, 2, 3].map((roundNumber) => ({
    id: "",
    roundNumber,
    startsAt: "",
    endsAt: "",
    isEnabled: false,
  }));

const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error)
    ? (error.response?.data?.message ?? fallback)
    : error instanceof Error
      ? error.message
      : fallback;

export function FeedbackConfigView() {
  const { data: loadedTerms } = useAcademicTerms();
  const terms = loadedTerms ?? [];
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();
  const [academicTermId, setAcademicTermId] = useState("");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [rounds, setRounds] = useState<RoundState[]>(emptyRounds());
  const [locked, setLocked] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  const loadTermConfig = useCallback(
    (termId: string) => {
      setLoadingConfig(true);
      void axios
        .get(
          `${NEXT_PUBLIC_API_BASE_URL}/admin/feedback/configuration/term/${termId}`,
          { withCredentials: true }
        )
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
              emptyRounds().map((round) => {
                const saved = config.rounds.find(
                  (item: { roundNumber: number }) =>
                    item.roundNumber === round.roundNumber
                );
                return saved
                  ? {
                      id: saved.id,
                      roundNumber: saved.roundNumber,
                      startsAt: saved.startsAt.slice(0, 16),
                      endsAt: saved.endsAt.slice(0, 16),
                      isEnabled: saved.isEnabled,
                    }
                  : round;
              })
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
    },
    [NEXT_PUBLIC_API_BASE_URL]
  );

  useEffect(() => {
    void axios
      .get(`${NEXT_PUBLIC_API_BASE_URL}/admin/feedback/presets`, {
        withCredentials: true,
      })
      .then((response) => setPresets(response.data.data ?? []))
      .catch(() => setPresets([]));
  }, [NEXT_PUBLIC_API_BASE_URL]);

  useEffect(() => {
    if (!academicTermId) {
      setPresetId("");
      setQuestions([]);
      setRounds(emptyRounds());
      setLocked(false);
      return;
    }
    loadTermConfig(academicTermId);
  }, [academicTermId, loadTermConfig]);

  const selectedPreset = presets.find((preset) => preset.id === presetId);
  const displayQuestions =
    questions.length > 0 ? questions : (selectedPreset?.questions ?? []);

  const saveQuestionSet = async () => {
    if (!academicTermId || !presetId) return;
    try {
      await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/feedback/configuration/term`,
        { academicTermId, presetId },
        { withCredentials: true }
      );
      toast.success("Feedback question set saved");
      loadTermConfig(academicTermId);
    } catch (error) {
      toast.error(errorMessage(error, "Could not save question set"));
    }
  };

  const saveRounds = async () => {
    if (!academicTermId) return;
    try {
      for (const round of rounds) {
        if (!round.startsAt || !round.endsAt)
          throw new Error(`Set dates for round ${round.roundNumber}`);
        const payload = {
          academicTermId,
          roundNumber: round.roundNumber,
          startsAt: new Date(round.startsAt).toISOString(),
          endsAt: new Date(round.endsAt).toISOString(),
          isEnabled: round.isEnabled,
        };
        if (round.id) {
          await axios.patch(
            `${NEXT_PUBLIC_API_BASE_URL}/admin/feedback/rounds/${round.id}`,
            payload,
            { withCredentials: true }
          );
        } else {
          const response = await axios.post(
            `${NEXT_PUBLIC_API_BASE_URL}/admin/feedback/rounds`,
            payload,
            { withCredentials: true }
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
      loadTermConfig(academicTermId);
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
      await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/feedback/rounds/${round.id}/${action}`,
        {},
        { withCredentials: true }
      );
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

  const isRoundActive = (round: RoundState) =>
    round.isEnabled &&
    round.startsAt.length > 0 &&
    round.endsAt.length > 0 &&
    new Date() >= new Date(round.startsAt) &&
    new Date() <= new Date(round.endsAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Feedback Configuration</h1>
        <p className="text-muted-foreground text-sm">
          Select an academic term, choose a question preset, set three round
          date ranges, save, then enable each round when ready.
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
            onChange={(event) => setAcademicTermId(event.target.value)}
          >
            <option value="">Select academic term</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.type.toUpperCase()} {term.year}
                {term.isCurrent ? " (Current)" : ""}
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
            disabled={!academicTermId || locked}
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
              configured for this term.
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
            disabled={!academicTermId || !presetId || locked}
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
            const active = isRoundActive(round);
            return (
              <div
                key={round.roundNumber}
                className="grid gap-3 md:grid-cols-5"
              >
                <p className="self-center font-medium">
                  Round {round.roundNumber}
                </p>
                <Input
                  type="datetime-local"
                  value={round.startsAt}
                  onChange={(event) =>
                    setRounds((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, startsAt: event.target.value }
                          : item
                      )
                    )
                  }
                />
                <Input
                  type="datetime-local"
                  value={round.endsAt}
                  onChange={(event) =>
                    setRounds((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, endsAt: event.target.value }
                          : item
                      )
                    )
                  }
                />
                <span className="text-muted-foreground self-center text-sm">
                  {active ? "Active" : "Inactive"}
                </span>
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
              </div>
            );
          })}
          <Button onClick={saveRounds} disabled={!academicTermId}>
            Save rounds
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
