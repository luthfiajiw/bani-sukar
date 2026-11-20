"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  name?: string;
}

function Switch({
  className,
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  name,
  onClick,
  ...props
}: SwitchProps) {
  const [uncontrolledChecked, setUncontrolledChecked] =
    React.useState(defaultChecked);
  const isControlled = controlledChecked !== undefined;
  const isChecked = isControlled ? controlledChecked : uncontrolledChecked;

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || disabled) return;
    const next = !isChecked;
    if (!isControlled) {
      setUncontrolledChecked(next);
    }
    onCheckedChange?.(next);
  };

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        data-slot="switch"
        data-state={isChecked ? "checked" : "unchecked"}
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          isChecked ? "bg-primary" : "bg-input",
          className,
        )}
        {...props}
      >
        <span
          data-slot="switch-thumb"
          data-state={isChecked ? "checked" : "unchecked"}
          className={cn(
            "pointer-events-none block size-4 rounded-full bg-card shadow-sm ring-0 transition-transform",
            isChecked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={isChecked ? "true" : "false"}
        />
      ) : null}
    </>
  );
}

export { Switch };
