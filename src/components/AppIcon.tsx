import { iconGradient, iconInitials } from "@/lib/store";
import { cn } from "@/lib/utils";

export function AppIcon({
  name,
  slug,
  url,
  size = 56,
  className,
}: {
  name: string;
  slug: string;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const radius = Math.round(size * 0.28);
  if (url) {
    return (
      <img
        src={url}
        alt={`${name} icon`}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: radius }}
        className={cn("object-cover shadow-sm", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: iconGradient(slug),
        fontSize: size * 0.36,
      }}
      className={cn(
        "grid place-items-center font-display font-bold text-white shadow-sm ring-1 ring-black/5",
        className,
      )}
    >
      {iconInitials(name)}
    </div>
  );
}
