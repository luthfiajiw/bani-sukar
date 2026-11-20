"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

function useIsClient() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

interface DropdownMenuContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const DropdownMenuContext =
  React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) {
    throw new Error(
      "DropdownMenu components must be used within <DropdownMenu>",
    );
  }
  return ctx;
}

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function DropdownMenu({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return (
    <DropdownMenuContext.Provider
      value={{ open, onOpenChange: handleOpenChange, triggerRef }}
    >
      {children}
    </DropdownMenuContext.Provider>
  );
}

export interface DropdownMenuTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function DropdownMenuTrigger({
  asChild = false,
  onClick,
  children,
  ...props
}: DropdownMenuTriggerProps) {
  const { open, onOpenChange, triggerRef } = useDropdownMenuContext();

  if (
    asChild &&
    React.isValidElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>(
      children,
    )
  ) {
    const childOnClick = children.props.onClick;
    return React.cloneElement(children, {
      ...props,
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        triggerRef.current = e.currentTarget;
        childOnClick?.(e);
        if (!e.defaultPrevented) {
          onOpenChange(!open);
        }
      },
    });
  }

  return (
    <button
      ref={(el) => {
        triggerRef.current = el;
      }}
      type="button"
      data-slot="dropdown-menu-trigger"
      aria-expanded={open}
      onClick={(e) => {
        triggerRef.current = e.currentTarget;
        onClick?.(e);
        if (!e.defaultPrevented) {
          onOpenChange(!open);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export interface DropdownMenuContentProps extends React.ComponentProps<"div"> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 4,
  children,
  style,
  ...props
}: DropdownMenuContentProps) {
  const { open, onOpenChange, triggerRef } = useDropdownMenuContext();
  const isClient = useIsClient();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = React.useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const contentWidth = contentRef.current?.offsetWidth ?? 180;
    let left = rect.left;
    if (align === "center") {
      left = rect.left + rect.width / 2 - contentWidth / 2;
    } else if (align === "end") {
      left = rect.right - contentWidth;
    }
    const maxLeft = Math.max(8, window.innerWidth - contentWidth - 8);
    left = Math.min(Math.max(8, left), maxLeft);
    setCoords({ top: rect.bottom + sideOffset, left });
  }, [align, sideOffset, triggerRef]);

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
      onOpenChange(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
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
  }, [open, onOpenChange, triggerRef, updatePosition]);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      ref={contentRef}
      role="menu"
      data-slot="dropdown-menu-content"
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        ...style,
      }}
      className={cn(
        "z-50 min-w-[11rem] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}

function DropdownMenuGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="dropdown-menu-group"
      className={cn(className)}
      {...props}
    />
  );
}

export interface DropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean;
  variant?: "default" | "destructive";
  asChild?: boolean;
  onSelect?: () => void;
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  asChild = false,
  onClick,
  onSelect,
  disabled,
  children,
  ...props
}: DropdownMenuItemProps) {
  const { onOpenChange } = useDropdownMenuContext();

  const itemClasses = cn(
    "relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors outline-none select-none hover:bg-secondary focus:bg-secondary disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    inset && "pl-8",
    variant === "destructive" &&
      "text-destructive hover:bg-destructive/10 focus:bg-destructive/10",
    className,
  );

  if (
    asChild &&
    React.isValidElement<{
      className?: string;
      onClick?: React.MouseEventHandler<HTMLElement>;
    }>(children)
  ) {
    const childOnClick = children.props.onClick;
    return React.cloneElement(children, {
      ...props,
      className: cn(itemClasses, children.props.className),
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        childOnClick?.(e);
        if (!e.defaultPrevented && !disabled) {
          onSelect?.();
          onOpenChange(false);
        }
      },
    });
  }

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && !disabled) {
          onSelect?.();
          onOpenChange(false);
        }
      }}
      className={itemClasses}
      {...props}
    >
      {children}
    </button>
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onCheckedChange,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={Boolean(checked)}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2.5 pl-8 text-left text-sm transition-colors outline-none select-none hover:bg-secondary focus:bg-secondary",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        {checked ? <Check className="size-3.5" /> : null}
      </span>
      {children}
    </button>
  );
}

const DropdownMenuRadioContext = React.createContext<{
  value?: string;
  onValueChange?: (val: string) => void;
}>({});

function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuRadioContext.Provider value={{ value, onValueChange }}>
      <div role="group">{children}</div>
    </DropdownMenuRadioContext.Provider>
  );
}

function DropdownMenuRadioItem({
  className,
  value,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const radioCtx = React.useContext(DropdownMenuRadioContext);
  const { onOpenChange } = useDropdownMenuContext();
  const isSelected = radioCtx.value === value;

  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={isSelected}
      onClick={() => {
        radioCtx.onValueChange?.(value);
        onOpenChange(false);
      }}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2.5 pl-8 text-left text-sm transition-colors outline-none select-none hover:bg-secondary focus:bg-secondary",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex size-2 items-center justify-center rounded-full">
        {isSelected ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      {children}
    </button>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2.5 py-1.5 text-xs font-semibold text-muted-foreground",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="separator"
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
