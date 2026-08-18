"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frontendEnv } from "@webcampus/common/env";
import { AcademicTermResponseType } from "@webcampus/schemas/admin";
import { BaseResponse } from "@webcampus/types/api";
import { Button } from "@webcampus/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import axios from "axios";
import { Wand2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-toastify";

export const GenerateProctorGroupsDialog = () => {
  const queryClient = useQueryClient();
  const { NEXT_PUBLIC_API_BASE_URL } = frontendEnv();

  const [open, setOpen] = useState(false);
  const [termId, setTermId] = useState<string>("");
  const [semesterId, setSemesterId] = useState<string>("");
  const [studentsPerGroup, setStudentsPerGroup] = useState<number>(30);

  const { data: terms, isLoading: isLoadingTerms } = useQuery({
    queryKey: ["academic-terms"],
    queryFn: async () => {
      const res = await axios.get<BaseResponse<AcademicTermResponseType[]>>(
        `${NEXT_PUBLIC_API_BASE_URL}/admin/semester`,
        { withCredentials: true }
      );
      if (res.data.status === "success") return res.data.data;
      return [] as AcademicTermResponseType[];
    },
  });

  const selectedTerm = terms?.find((t) => t.id === termId);
  const semesters = selectedTerm?.Semester || [];

  const generateMutation = useMutation({
    mutationFn: async ({ action }: { action: "generate" | "regenerate" }) => {
      const res = await axios.post(
        `${NEXT_PUBLIC_API_BASE_URL}/department/proctor/generate`,
        { semesterId, studentsPerGroup, action },
        { withCredentials: true }
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Proctor groups generated successfully");
      queryClient.invalidateQueries({ queryKey: ["proctor-students"] });
      queryClient.invalidateQueries({ queryKey: ["proctor-groups"] });
      setOpen(false);
    },
    onError: (error: import("axios").AxiosError<{ message?: string }>) => {
      toast.error(error.response?.data?.message || "Failed to generate groups");
    },
  });

  const handleAction = (action: "generate" | "regenerate") => {
    if (!semesterId) {
      toast.error("Please select a semester");
      return;
    }
    if (studentsPerGroup < 1) {
      toast.error("Students per group must be at least 1");
      return;
    }

    if (action === "regenerate") {
      if (
        !window.confirm(
          "Regenerating the proctor groups will replace the current automatic student distribution. Manual student movements may be lost. Are you sure?"
        )
      ) {
        return;
      }
    }

    generateMutation.mutate({ action });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <Wand2 className="mr-2 h-4 w-4" />
          Generate Groups
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate Proctor Groups</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Academic Term</Label>
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Term" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingTerms ? (
                  <SelectItem value="loading" disabled>
                    Loading...
                  </SelectItem>
                ) : (
                  terms?.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.type} ({term.year})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Semester</Label>
            <Select
              value={semesterId}
              onValueChange={setSemesterId}
              disabled={!termId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Semester" />
              </SelectTrigger>
              <SelectContent>
                {semesters.map(
                  (sem: {
                    id: string;
                    semesterNumber: number;
                    programType: string;
                  }) => (
                    <SelectItem key={sem.id} value={sem.id}>
                      Semester {sem.semesterNumber} ({sem.programType})
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Students Per Group</Label>
            <Input
              type="number"
              min={1}
              value={studentsPerGroup}
              onChange={(e) =>
                setStudentsPerGroup(parseInt(e.target.value) || 0)
              }
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            onClick={() => handleAction("regenerate")}
            disabled={generateMutation.isPending || !semesterId}
          >
            Regenerate All
          </Button>
          <Button
            onClick={() => handleAction("generate")}
            disabled={generateMutation.isPending || !semesterId}
          >
            {generateMutation.isPending
              ? "Generating..."
              : "Generate for Unassigned"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
