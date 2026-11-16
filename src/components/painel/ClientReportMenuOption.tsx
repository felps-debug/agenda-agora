import type { LucideIcon } from "lucide-react";

type ClientReportMenuOptionProps = {
  label: string;
  Icon: LucideIcon;
  color: string;
  unavailable?: boolean | undefined;
  onSelect: () => void;
};

export function ClientReportMenuOption({
  label,
  Icon,
  color,
  unavailable = false,
  onSelect,
}: ClientReportMenuOptionProps) {
  const visibleLabel = unavailable ? label + " (em breve)" : label;
  const buttonClass =
    "flex h-32 w-full items-center justify-center rounded-xl border border-[var(--c-rgba-51-125-255-a0d29)] bg-[var(--c-rgba-22-119-255-a0d09)] shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_0_18px_var(--c-rgba-22-119-255-a0d08)] transition-colors hover:border-[var(--c-rgba-51-125-255-a0d5)] hover:bg-[var(--c-rgba-22-119-255-a0d14)] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onSelect}
        disabled={unavailable}
        aria-disabled={unavailable}
        aria-label={visibleLabel}
        className={buttonClass}
      >
        <Icon className={"size-12 " + color} strokeWidth={1.8} />
      </button>
      <span className="mt-2 text-center text-[13px] font-medium leading-tight text-[var(--c-e5e7eb)]">
        {visibleLabel}
      </span>
    </div>
  );
}
