"use client";

import { cn } from "@webcampus/ui/lib/utils";
import * as React from "react";

interface RadioGroupContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  name?: string;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({});

interface RadioGroupProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
}

function RadioGroup({
  className,
  value,
  defaultValue,
  onValueChange,
  name,
  children,
  ...props
}: RadioGroupProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const selectedValue = value ?? internalValue;

  const handleChange = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [onValueChange, value]
  );

  return (
    <RadioGroupContext.Provider
      value={{
        value: selectedValue,
        onValueChange: handleChange,
        name,
      }}
    >
      <div role="radiogroup" className={cn("grid gap-2", className)} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

interface RadioGroupItemProps
  extends Omit<React.ComponentProps<"input">, "type" | "onChange" | "checked"> {
  value: string;
}

function RadioGroupItem({
  className,
  value,
  id,
  ...props
}: RadioGroupItemProps) {
  const context = React.useContext(RadioGroupContext);
  const isChecked = context.value === value;

  return (
    <input
      type="radio"
      id={id}
      name={context.name}
      checked={isChecked}
      onChange={() => context.onValueChange?.(value)}
      className={cn(
        "border-input text-primary focus-visible:ring-ring h-4 w-4 rounded-full border",
        className
      )}
      {...props}
    />
  );
}

export { RadioGroup, RadioGroupItem };
