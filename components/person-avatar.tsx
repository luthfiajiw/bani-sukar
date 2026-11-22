import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";

const SIZE_STYLES = {
  sm: {
    container: "size-8 text-xs",
    dot: "size-2 right-0 bottom-0 ring-[1.5px]",
  },
  md: {
    container: "size-10 text-sm",
    dot: "size-2.5 right-0 bottom-0 ring-2",
  },
  lg: {
    container: "size-14 text-lg",
    dot: "size-3 right-0.5 bottom-0.5 ring-2",
  },
  xl: {
    container: "size-20 text-2xl",
    dot: "size-3.5 right-1 bottom-1 ring-2",
  },
} as const;

export function PersonAvatar({
  fullName,
  gender,
  isDeceased = false,
  size = "md",
  className,
}: {
  fullName: string;
  gender: "L" | "P";
  isDeceased?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const initials = getInitials(fullName);
  const styles = SIZE_STYLES[size];

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full border-2 font-semibold tracking-tight select-none shadow-xs",
        gender === "L"
          ? "border-[#cbb4a3] bg-[#efe5dc] text-[#5c3d2e]"
          : "border-[#dfc48f] bg-[#f8edd6] text-[#7a541a]",
        styles.container,
        className,
      )}
      aria-label={`${fullName} (${gender === "L" ? "Laki-laki" : "Perempuan"}, ${isDeceased ? "Almarhum/Wafat" : "Masih Hidup"})`}
    >
      <span>{initials}</span>
      <span
        title={isDeceased ? "Almarhum / Wafat" : "Masih Hidup"}
        className={cn(
          "absolute rounded-full ring-card",
          isDeceased ? "bg-[#ba1a1a]" : "bg-[#2d4030]",
          styles.dot,
        )}
      />
    </div>
  );
}
