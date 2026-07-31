import type { SVGProps } from "react";

export interface VolumeOffFilledIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}

/**
 * Solid muted-volume glyph (speaker + slash) — the filled companion to
 * `PlayFilledIcon`, matching media-chrome's icon family so video unmute
 * affordances read identically to real player chrome. Hand-maintained (the
 * Figma-generated set has only outline volume icons).
 */
export function VolumeOffFilledIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: VolumeOffFilledIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63Zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71ZM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3ZM12 4 9.91 6.09 12 8.18V4Z"
      />
    </svg>
  );
}
