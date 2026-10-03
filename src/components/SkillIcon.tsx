import { skillIcons } from "@/lib/skillIcons";

type SkillIconProps = {
  name: string;
  className?: string;
  size?: "sm" | "md";
};

export function SkillIcon({ name, className = "", size = "sm" }: SkillIconProps) {
  const icon = skillIcons[name];
  const box = size === "md" ? "h-5 w-5" : "h-4 w-4";

  if (!icon) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-semibold uppercase text-foreground/80 ${box} ${className}`}
        aria-hidden
      >
        {name.slice(0, 2)}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${box} ${className}`}
      style={icon.color ? { color: icon.color } : undefined}
      aria-hidden
    >
      <svg
        viewBox={icon.viewBox}
        className="h-full w-full"
        role="img"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: icon.body }}
      />
    </span>
  );
}
