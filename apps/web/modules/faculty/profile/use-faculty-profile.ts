"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  CreateFacultyExperienceSchema,
  CreateFacultyPublicationSchema,
  CreateFacultyQualificationSchema,
  FacultyGenderEnum,
  MaritalStatusEnum,
  PublicationCategoryEnum,
  QualificationProgramTypeEnum,
  StaffTypeEnum,
  UpdateFacultyProfileSchema,
} from "@webcampus/schemas/faculty";
import { BaseResponse } from "@webcampus/types/api";
import { toast } from "react-toastify";
import { z } from "zod";

const profileQueryKey = ["faculty-profile"] as const;

export type FacultyQualification = z.infer<typeof CreateFacultyQualificationSchema> & {
  id: string;
};

export type FacultyPublication = z.infer<typeof CreateFacultyPublicationSchema> & {
  id: string;
};

export type FacultyExperience = z.infer<typeof CreateFacultyExperienceSchema> & {
  id: string;
  durationLabel?: string;
};

export type FacultyProfilePayload = {
  id: string;
  employeeId?: string | null;
  staffType?: z.infer<typeof StaffTypeEnum> | null;
  designation: string;
  qualification?: string | null;
  dateOfJoining?: string | null;
  researchArea?: string | null;
  officeRoom?: string | null;
  gender?: z.infer<typeof FacultyGenderEnum> | null;
  dob?: string | null;
  bloodGroup?: string | null;
  nationality?: string | null;
  phoneNumber?: string | null;
  personalEmail?: string | null;
  maritalStatus?: z.infer<typeof MaritalStatusEnum> | null;
  aboutYourself?: string | null;
  researchInterests?: string | null;
  otherInformation?: string | null;
  contactInformation?: string | null;
  mobileNumber?: string | null;
  alternateContactNumber?: string | null;
  presentAddressLine?: string | null;
  presentCity?: string | null;
  presentState?: string | null;
  presentPincode?: string | null;
  permanentAddressLine?: string | null;
  permanentCity?: string | null;
  permanentState?: string | null;
  permanentPincode?: string | null;
  sameAsPresentAddress?: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    username?: string | null;
    displayUsername?: string | null;
  };
  department: {
    id: string;
    name: string;
    code: string;
  };
  qualifications: FacultyQualification[];
  publications: FacultyPublication[];
  experiences: FacultyExperience[];
};

const unwrapSuccess = <T>(response: BaseResponse<T>) => {
  if (response.status !== "success") {
    throw new Error(response.message);
  }
  return response.data;
};

const invalidateProfile = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: profileQueryKey });
};

export const useFacultyProfile = () => {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: async () => {
      const response = await apiClient.get<BaseResponse<FacultyProfilePayload>>(
        "/faculty/profile"
      );
      return unwrapSuccess(response.data);
    },
  });
};

export const useUpdateFacultyProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: z.input<typeof UpdateFacultyProfileSchema>) => {
      const validated = UpdateFacultyProfileSchema.parse(payload);
      const response = await apiClient.put<BaseResponse<FacultyProfilePayload>>(
        "/faculty/profile",
        validated
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Profile updated");
      invalidateProfile(queryClient);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to update profile"));
    },
  });
};

export const useCreateQualification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: z.input<typeof CreateFacultyQualificationSchema>) => {
      const validated = CreateFacultyQualificationSchema.parse(payload);
      const response = await apiClient.post<BaseResponse<FacultyQualification>>(
        "/faculty/profile/qualifications",
        validated
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Qualification added");
      invalidateProfile(queryClient);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to add qualification"));
    },
  });
};

export const useUpdateQualification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: z.input<typeof CreateFacultyQualificationSchema>;
    }) => {
      const validated = CreateFacultyQualificationSchema.parse(payload);
      const response = await apiClient.put<BaseResponse<FacultyQualification>>(
        `/faculty/profile/qualifications/${id}`,
        validated
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Qualification updated");
      invalidateProfile(queryClient);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to update qualification"));
    },
  });
};

export const useDeleteQualification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<BaseResponse<null>>(
        `/faculty/profile/qualifications/${id}`
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Qualification deleted");
      invalidateProfile(queryClient);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to delete qualification"));
    },
  });
};

export const useCreatePublication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: z.input<typeof CreateFacultyPublicationSchema>) => {
      const validated = CreateFacultyPublicationSchema.parse(payload);
      const response = await apiClient.post<BaseResponse<FacultyPublication>>(
        "/faculty/profile/publications",
        validated
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Publication added");
      invalidateProfile(queryClient);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to add publication"));
    },
  });
};

export const useUpdatePublication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: z.input<typeof CreateFacultyPublicationSchema>;
    }) => {
      const validated = CreateFacultyPublicationSchema.parse(payload);
      const response = await apiClient.put<BaseResponse<FacultyPublication>>(
        `/faculty/profile/publications/${id}`,
        validated
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Publication updated");
      invalidateProfile(queryClient);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to update publication"));
    },
  });
};

export const useDeletePublication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<BaseResponse<null>>(
        `/faculty/profile/publications/${id}`
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Publication deleted");
      invalidateProfile(queryClient);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to delete publication"));
    },
  });
};

export const useCreateExperience = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: z.input<typeof CreateFacultyExperienceSchema>) => {
      const validated = CreateFacultyExperienceSchema.parse(payload);
      const response = await apiClient.post<BaseResponse<FacultyExperience>>(
        "/faculty/profile/experiences",
        validated
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Experience added");
      invalidateProfile(queryClient);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to add experience"));
    },
  });
};

export const useUpdateExperience = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: z.input<typeof CreateFacultyExperienceSchema>;
    }) => {
      const validated = CreateFacultyExperienceSchema.parse(payload);
      const response = await apiClient.put<BaseResponse<FacultyExperience>>(
        `/faculty/profile/experiences/${id}`,
        validated
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Experience updated");
      invalidateProfile(queryClient);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to update experience"));
    },
  });
};

export const useDeleteExperience = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<BaseResponse<null>>(
        `/faculty/profile/experiences/${id}`
      );
      return unwrapSuccess(response.data);
    },
    onSuccess: () => {
      toast.success("Experience deleted");
      invalidateProfile(queryClient);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to delete experience"));
    },
  });
};

export const qualificationProgramTypeOptions = QualificationProgramTypeEnum.options;
export const publicationCategoryOptions = PublicationCategoryEnum.options;
