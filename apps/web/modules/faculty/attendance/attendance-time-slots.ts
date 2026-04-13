import { FacultyFixedTimingCodeType } from "@webcampus/schemas/faculty";

export type AttendanceTimeSlot = {
  code: FacultyFixedTimingCodeType;
  label: string;
  startTime: string;
  endTime: string;
};

export const ATTENDANCE_TIME_SLOTS: AttendanceTimeSlot[] = [
  {
    code: "08:00-08:55",
    label: "08:00 AM - 08:55 AM",
    startTime: "08:00",
    endTime: "08:55",
  },
  {
    code: "08:55-09:50",
    label: "08:55 AM - 09:50 AM",
    startTime: "08:55",
    endTime: "09:50",
  },
  {
    code: "09:50-10:45",
    label: "09:50 AM - 10:45 AM",
    startTime: "09:50",
    endTime: "10:45",
  },
  {
    code: "11:15-12:10",
    label: "11:15 AM - 12:10 PM",
    startTime: "11:15",
    endTime: "12:10",
  },
  {
    code: "12:10-13:05",
    label: "12:10 PM - 01:05 PM",
    startTime: "12:10",
    endTime: "13:05",
  },
  {
    code: "14:00-14:55",
    label: "02:00 PM - 02:55 PM",
    startTime: "14:00",
    endTime: "14:55",
  },
  {
    code: "14:55-15:50",
    label: "02:55 PM - 03:50 PM",
    startTime: "14:55",
    endTime: "15:50",
  },
  {
    code: "15:50-16:45",
    label: "03:50 PM - 04:45 PM",
    startTime: "15:50",
    endTime: "16:45",
  },
];
