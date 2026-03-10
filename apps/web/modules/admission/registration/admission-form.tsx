"use client";

import { useForm } from "react-hook-form";

type AdmissionFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  semester: string;
};

export function AdmissionForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdmissionFormData>();

  const onSubmit = (data: AdmissionFormData) => {
    console.log("Admission Data:", data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
      <div>
        <label>First Name</label>
        <input
          {...register("firstName", { required: true })}
          className="w-full rounded border p-2"
        />
        {errors.firstName && <p className="text-red-500">Required</p>}
      </div>

      <div>
        <label>Last Name</label>
        <input
          {...register("lastName", { required: true })}
          className="w-full rounded border p-2"
        />
      </div>

      <div>
        <label>Email</label>
        <input
          type="email"
          {...register("email", { required: true })}
          className="w-full rounded border p-2"
        />
      </div>

      <div>
        <label>Phone</label>
        <input
          {...register("phone", { required: true })}
          className="w-full rounded border p-2"
        />
      </div>

      <div>
        <label>Department</label>
        <select
          {...register("department", { required: true })}
          className="w-full rounded border p-2"
        >
          <option value="">Select Department</option>
          <option value="CSE">CSE</option>
          <option value="ECE">ECE</option>
          <option value="ME">Mechanical</option>
        </select>
      </div>

      <div>
        <label>Semester</label>
        <select
          {...register("semester", { required: true })}
          className="w-full rounded border p-2"
        >
          <option value="">Select Semester</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </div>

      <button type="submit" className="rounded bg-black px-4 py-2 text-white">
        Submit Admission
      </button>
    </form>
  );
}
