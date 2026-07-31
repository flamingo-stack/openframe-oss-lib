import type { SVGProps } from "react";

export interface PlayFilledIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}

/**
 * Solid play triangle — the SAME glyph media-chrome/MuxPlayer renders in its
 * native center play button, so custom video affordances (strip cards,
 * facades, carousels) stay pixel-consistent with real player chrome.
 * Hand-maintained (not in the Figma-generated set, which has only the
 * outline `PlayIcon`).
 */
export function PlayFilledIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PlayFilledIconProps) {
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
      <path fill={color} d="m6 21 15-9L6 3v18Z" />
    </svg>
  );
}
