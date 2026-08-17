"use client";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StudentProfileRequestApprovalSchema } from "@webcampus/schemas/student";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";

export const studentProfileQueryKey = ["student-profile"] as const;

export type StudentProfilePayload = {
  id: string;
  usn: string;
  currentSemester: number;
  semesterId?: string | null;
  academicYear: string;
  departmentName: string;
  programType?: "UG" | "PG" | null;
  semesterNumber?: number | null;
  admissionStatus?:
    | "PENDING"
    | "SUBMITTED"
    | "APPROVED"
    | "REJECTED"
    | "EXITED"
    | null;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  profile: {
    fullName?: string | null;
    collegeEmail?: string | null;
    mobileNumber?: string | null;
    dob?: string | null;
    gender?: string | null;
    bloodGroup?: string | null;
    aidedStatus?: "AIDED" | "UNAIDED" | null;
    category?: string | null;
    personalEmail?: string | null;
    alternatePhone?: string | null;
    aadhaarNumber?: string | null;
    admissionQuota?: string | null;
    nationality?: string | null;
    passportNumber?: string | null;
    visaValidityDetails?: string | null;
    permanentAddress?: string | null;
    presentAddress?: string | null;
    sameAsPermanentAddress?: boolean;
    father?: {
      name?: string | null;
      occupation?: string | null;
      qualification?: string | null;
      mobile?: string | null;
      email?: string | null;
    };
    mother?: {
      name?: string | null;
      occupation?: string | null;
      qualification?: string | null;
      mobile?: string | null;
      email?: string | null;
    };
    academic?: {
      academicYear?: string | null;
      departmentName?: string | null;
      programme?: string | null;
      semester?: number | null;
      section?: string | null;
    };
    education?: {
      class10?: {
        school?: string | null;
        board?: string | null;
        percentage?: number | null;
        year?: string | null;
      };
      class12OrDiploma?: {
        school?: string | null;
        board?: string | null;
        percentage?: number | null;
        year?: string | null;
      };
      entranceExamDetails?: string | null;
    };
    documents?: {
      aadhaarCard?: string | null;
      photo?: string | null;
      marksCards?: string | null;
      otherDocuments?: string | null;
    };
  };
};

const unwrapSuccess = <T>(response: BaseResponse<T>) => {
  if (response.status !== "success") {
    throw new Error(response.message);
  }
  return response.data;
};

const invalidateStudentProfile = (
  queryClient: ReturnType<typeof useQueryClient>
) => {
  queryClient.invalidateQueries({ queryKey: studentProfileQueryKey });
};

export const useStudentProfile = () => {
  return useQuery({
    queryKey: studentProfileQueryKey,
    queryFn: async () => {
      const response =
        await apiClient.get<BaseResponse<StudentProfilePayload>>(
          "/student/profile"
        );
      return unwrapSuccess(response.data);
    },
  });
};

export const useRequestStudentProfileApproval = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const payload = StudentProfileRequestApprovalSchema.parse({});
      const response = await apiClient.post<BaseResponse<unknown>>(
        "/student/profile/request-approval",
        payload
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Approval request submitted");
      invalidateStudentProfile(queryClient);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to submit approval request")
      );
    },
  });
};
