import type { SVGProps } from "react";
export interface ClockHistoryIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ClockHistoryIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ClockHistoryIconProps) {
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
        d="M4.105 5.66c2.75-3.427 7.53-4.779 11.789-3.003 5.161 2.151 7.602 8.079 5.45 13.24-2.084 5-7.713 7.447-12.755 5.638l-.485-.187a10.1 10.1 0 0 1-2.915-1.85l-.349-.333-.077-.086a1.124 1.124 0 0 1 1.582-1.582l.086.078.271.257a7.9 7.9 0 0 0 2.266 1.439l.38.146A7.875 7.875 0 1 0 6.087 6.8a1.124 1.124 0 0 1 .306 2.214l-2.424.616A1.125 1.125 0 0 1 2.6 8.815L1.987 6.39l1.091-.275.835-.212-1.926.487a1.124 1.124 0 0 1 2.118-.731Z"
      />
      <path
        fill={color}
        d="M2.555 15.44v-.01a1.125 1.125 0 0 1 2.25 0v.01a1.125 1.125 0 0 1-2.25 0M10.875 7a1.125 1.125 0 0 1 2.25 0v4.524l2.672 2.682.077.085a1.126 1.126 0 0 1-1.586 1.58l-.085-.077-3-3.01a1.13 1.13 0 0 1-.328-.794zm-9 5v-.01a1.125 1.125 0 0 1 2.25 0V12a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
