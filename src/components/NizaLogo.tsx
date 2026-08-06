import logoAsset from "@/assets/niza-logo.png.asset.json";
import { cn } from "@/lib/utils";

/** Official Niza App Store logo. Never recolor, stretch or crop it. */
export function NizaLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Niza App Store logo"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
