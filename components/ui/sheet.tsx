"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

function useIsClient() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext() {
  const ctx = React.useContext(SheetContext);
  if (!ctx) {
    throw new Error("Sheet components must be used within <Sheet>");
  }
  return ctx;
}

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Sheet({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
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
    <SheetContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

export interface SheetTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function SheetTrigger({
  asChild = false,
  onClick,
  children,
  ...props
}: SheetTriggerProps) {
  const { onOpenChange } = useSheetContext();

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
        childOnClick?.(e);
        if (!e.defaultPrevented) {
          onOpenChange(true);
        }
      },
    });
  }

  return (
    <button
      type="button"
      data-slot="sheet-trigger"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          onOpenChange(true);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function SheetClose({
  asChild = false,
  onClick,
  children,
  ...props
}: SheetTriggerProps) {
  const { onOpenChange } = useSheetContext();

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
        childOnClick?.(e);
        if (!e.defaultPrevented) {
          onOpenChange(false);
        }
      },
    });
  }

  return (
    <button
      type="button"
      data-slot="sheet-close"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) {
          onOpenChange(false);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export interface SheetContentProps extends React.ComponentProps<"div"> {
  side?: "top" | "right" | "bottom" | "left";
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: SheetContentProps) {
  const { open, onOpenChange } = useSheetContext();
  const isClient = useIsClient();

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open || !isClient) return null;

  const sideClasses = {
    right: "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l",
    left: "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r",
    top: "inset-x-0 top-0 h-auto border-b",
    bottom: "inset-x-0 bottom-0 h-auto border-t",
  }[side];

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        data-slot="sheet-overlay"
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 border-border bg-card p-5 text-card-foreground shadow-xl transition-transform",
          sideClasses,
          className,
        )}
        {...props}
      >
        {children}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Tutup menu"
          className="absolute top-4 right-4 cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 pr-6", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="sheet-title"
      className={cn("text-base font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
