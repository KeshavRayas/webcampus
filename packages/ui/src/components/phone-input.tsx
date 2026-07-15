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

export function PhoneNumberInput({ className, ...props }: Props) {
  return (
    <PhoneInput
      international
      defaultCountry="IN"
      countryCallingCodeEditable={false}
      inputComponent={PhoneInputComponent}
      className={cn("phone-input", className)}
      {...props}
    />
  );
}
