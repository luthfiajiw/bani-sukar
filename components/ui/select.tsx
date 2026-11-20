"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

function useIsClient() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

interface SelectContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  value: string;
  onSelectValue: (value: string) => void;
  disabled?: boolean;
  labels: Map<string, React.ReactNode>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) {
    throw new Error("Select components must be used within <Select>");
  }
  return ctx;
}

function collectSelectLabels(
  nodes: React.ReactNode,
  map: Map<string, React.ReactNode>,
) {
  React.Children.forEach(nodes, (child) => {
    if (!React.isValidElement<{ value?: unknown; children?: React.ReactNode }>(child)) {
      return;
    }
    if (
      typeof child.props.value === "string" &&
      child.props.children !== undefined
    ) {
      map.set(child.props.value, child.props.children);
    }
    if (child.props.children) {
      collectSelectLabels(child.props.children, map);
    }
  });
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Select({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  disabled,
  name,
  required,
  children,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const labels = React.useMemo(() => {
    const map = new Map<string, React.ReactNode>();
    collectSelectLabels(children, map);
    return map;
  }, [children]);

  const handleSelectValue = React.useCallback(
    (next: string) => {
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      onValueChange?.(next);
      setOpen(false);
    },
    [isControlled, onValueChange],
  );

  return (
    <SelectContext.Provider
      value={{
        open,
        setOpen,
        value,
        onSelectValue: handleSelectValue,
        disabled,
        labels,
        triggerRef,
      }}
    >
      {children}
      {name ? (
        <input type="hidden" name={name} value={value} required={required} />
      ) : null}
    </SelectContext.Provider>
  );
}

function SelectGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="select-group"
      className={cn("p-1", className)}
      {...props}
    />
  );
}

function SelectValue({
  placeholder,
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const { value, labels } = useSelectContext();
  const label = value ? labels.get(value) : undefined;

  return (
    <span
      data-slot="select-value"
      className={cn(
        "truncate text-left",
        !label && "text-muted-foreground/80",
        className,
      )}
    >
      {label ?? (value || placeholder || "")}
    </span>
  );
}

function SelectTrigger({
  className,
  children,
  disabled: triggerDisabled,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen, disabled, triggerRef } = useSelectContext();
  const isDisabled = Boolean(disabled || triggerDisabled);

  return (
    <button
      ref={triggerRef}
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-controls="select-listbox"
      disabled={isDisabled}
      data-slot="select-trigger"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && !isDisabled) {
          setOpen(!open);
        }
      }}
      className={cn(
        "flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform",
          open && "rotate-180",
        )}
      />
    </button>
  );
}

function SelectContent({
  className,
  children,
  style,
  ...props
}: React.ComponentProps<"div">) {
  const { open, setOpen, triggerRef } = useSelectContext();
  const isClient = useIsClient();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = React.useState<{
    top: number;
    left: number;
    minWidth: number;
  }>({ top: 0, left: 0, minWidth: 160 });

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const contentHeight = contentRef.current?.offsetHeight ?? 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < Math.min(contentHeight, 220) && rect.top > spaceBelow;
    const top = openUpward
      ? Math.max(8, rect.top - contentHeight - 4)
      : rect.bottom + 4;
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);

    setCoords({ top, left, minWidth: rect.width });
  }, [triggerRef]);

  React.useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(updatePosition);
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        contentRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, setOpen, triggerRef, updatePosition]);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      ref={contentRef}
      id="select-listbox"
      role="listbox"
      data-slot="select-content"
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        minWidth: coords.minWidth,
        ...style,
      }}
      className={cn(
        "z-50 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg",
        className,
      )}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-label"
      className={cn(
        "px-2.5 py-1.5 text-xs font-semibold text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export interface SelectItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string;
}

function SelectItem({
  className,
  value,
  disabled,
  children,
  onClick,
  ...props
}: SelectItemProps) {
  const { value: selectedValue, onSelectValue } = useSelectContext();
  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      disabled={disabled}
      data-slot="select-item"
      data-state={isSelected ? "checked" : "unchecked"}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && !disabled) {
          onSelectValue(value);
        }
      }}
      className={cn(
        "relative flex w-full cursor-pointer items-center justify-between gap-2 rounded-md py-1.5 pr-8 pl-2.5 text-left text-sm transition-colors outline-none select-none hover:bg-secondary focus:bg-secondary disabled:pointer-events-none disabled:opacity-50",
        isSelected && "bg-secondary/70 font-medium text-foreground",
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      {isSelected ? (
        <span className="absolute right-2 flex size-4 items-center justify-center text-primary">
          <Check className="size-4" />
        </span>
      ) : null}
    </button>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="separator"
      data-slot="select-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
