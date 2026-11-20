"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface RadioGroupContextValue {
  value: string;
  onValueChange: (val: string) => void;
  disabled?: boolean;
  name?: string;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
  null,
);

export interface RadioGroupProps extends React.ComponentProps<"div"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
}

function RadioGroup({
  className,
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  disabled,
  name,
  children,
  ...props
}: RadioGroupProps) {
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : uncontrolledValue;

  const handleChange = React.useCallback(
    (next: string) => {
      if (disabled) return;
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      onValueChange?.(next);
    },
    [disabled, isControlled, onValueChange],
  );

  return (
    <RadioGroupContext.Provider
      value={{ value: activeValue, onValueChange: handleChange, disabled, name }}
    >
      <div
        role="radiogroup"
        data-slot="radio-group"
        className={cn("grid gap-2.5", className)}
        {...props}
      >
        {children}
        {name ? <input type="hidden" name={name} value={activeValue} /> : null}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string;
}

function RadioGroupItem({
  className,
  value,
  disabled: itemDisabled,
  onClick,
  ...props
}: RadioGroupItemProps) {
  const ctx = React.useContext(RadioGroupContext);
  if (!ctx) {
    throw new Error("RadioGroupItem must be used within <RadioGroup>");
  }

  const isChecked = ctx.value === value;
  const isDisabled = Boolean(ctx.disabled || itemDisabled);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isChecked}
      data-slot="radio-group-item"
      data-state={isChecked ? "checked" : "unchecked"}
      disabled={isDisabled}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && !isDisabled) {
          ctx.onValueChange(value);
        }
      }}
      className={cn(
        "relative flex aspect-square size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-primary/50 bg-card text-primary shadow-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        isChecked && "border-primary",
        className,
      )}
      {...props}
    >
      {isChecked ? (
        <span className="block size-2 rounded-full bg-primary" />
      ) : null}
    </button>
  );
}

export { RadioGroup, RadioGroupItem };
