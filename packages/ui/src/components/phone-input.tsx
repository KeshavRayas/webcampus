"use client";

import * as React from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "../lib/utils";
import { Input } from "./input";

type Props = React.ComponentProps<typeof PhoneInput>;

const PhoneInputComponent = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, ...props }, ref) => (
  <Input
    ref={ref}
    className={cn(
      "border-border rounded-l-none border-l focus-visible:ring-0 focus-visible:ring-offset-0",
      className
    )}
    {...props}
  />
));

PhoneInputComponent.displayName = "PhoneInputComponent";

const normalizePhoneValue = (value: string | undefined) => {
  if (!value) return value;

  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;

  return undefined;
};

export function PhoneNumberInput({
  className,
  value,
  defaultValue,
  ...props
}: Props) {
  return (
    <PhoneInput
      international
      defaultCountry="IN"
      countryCallingCodeEditable={false}
      inputComponent={PhoneInputComponent}
      className={cn("phone-input", className)}
      value={normalizePhoneValue(value)}
      defaultValue={normalizePhoneValue(defaultValue)}
      {...props}
    />
  );
}
