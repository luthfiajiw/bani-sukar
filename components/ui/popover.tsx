"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

function useIsClient() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

interface PopoverContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) {
    throw new Error("Popover components must be used within <Popover>");
  }
  return ctx;
}

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Popover({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: PopoverProps) {
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
    <PopoverContext.Provider
      value={{ open, onOpenChange: handleOpenChange, triggerRef }}
    >
      {children}
    </PopoverContext.Provider>
  );
}

export interface PopoverTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function PopoverTrigger({
  asChild = false,
  onClick,
  children,
  ...props
}: PopoverTriggerProps) {
  const { open, onOpenChange, triggerRef } = usePopoverContext();

  const setTriggerNode = (node: HTMLElement | null) => {
    triggerRef.current = node;
  };

  if (
    asChild &&
    React.isValidElement<{
      onClick?: React.MouseEventHandler<HTMLElement>;
      ref?: React.Ref<HTMLElement>;
    }>(children)
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
      ref={setTriggerNode}
      type="button"
      data-slot="popover-trigger"
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

function PopoverAnchor({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { triggerRef } = usePopoverContext();
  return (
    <div
      ref={(el) => {
        triggerRef.current = el;
      }}
      data-slot="popover-anchor"
      className={className}
    >
      {children}
    </div>
  );
}

export interface PopoverContentProps extends React.ComponentProps<"div"> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 6,
  children,
  style,
  ...props
}: PopoverContentProps) {
  const { open, onOpenChange, triggerRef } = usePopoverContext();
  const isClient = useIsClient();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = React.useState<{
    top: number;
    left: number;
    minWidth: number;
  }>({ top: 0, left: 0, minWidth: 200 });

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const contentWidth = contentRef.current?.offsetWidth ?? rect.width;
    let left = rect.left;
    if (align === "center") {
      left = rect.left + rect.width / 2 - contentWidth / 2;
    } else if (align === "end") {
      left = rect.right - contentWidth;
    }
    const maxLeft = Math.max(8, window.innerWidth - contentWidth - 8);
    left = Math.min(Math.max(8, left), maxLeft);

    setCoords({
      top: rect.bottom + sideOffset,
      left,
      minWidth: rect.width,
    });
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
      data-slot="popover-content"
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        minWidth: coords.minWidth,
        ...style,
      }}
      className={cn(
        "z-50 w-72 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
