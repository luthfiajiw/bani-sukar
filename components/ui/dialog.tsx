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

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error("Dialog components must be used within <Dialog>");
  }
  return ctx;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogProps) {
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
    <DialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export interface DialogTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function DialogTrigger({
  asChild = false,
  onClick,
  children,
  ...props
}: DialogTriggerProps) {
  const { onOpenChange } = useDialogContext();

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
      data-slot="dialog-trigger"
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

function DialogPortal({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(children, document.body);
}

function DialogClose({
  asChild = false,
  onClick,
  children,
  ...props
}: DialogTriggerProps) {
  const { onOpenChange } = useDialogContext();

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
      data-slot="dialog-close"
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

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { onOpenChange } = useDialogContext();

  return (
    <div
      data-slot="dialog-overlay"
      onClick={() => onOpenChange(false)}
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] animate-in fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

export interface DialogContentProps extends React.ComponentProps<"div"> {
  showCloseButton?: boolean;
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  const { open, onOpenChange } = useDialogContext();

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

  if (!open) return null;

  return (
    <DialogPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogOverlay />
        <div
          role="dialog"
          aria-modal="true"
          data-slot="dialog-content"
          className={cn(
            "relative z-50 grid w-full max-w-lg max-h-[90dvh] overflow-y-auto gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl",
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton ? (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Tutup"
              className="absolute top-4 right-4 cursor-pointer rounded-md p-1 text-muted-foreground opacity-80 transition-opacity hover:bg-secondary hover:text-foreground hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring outline-none"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn(
        "text-lg leading-none font-semibold tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
