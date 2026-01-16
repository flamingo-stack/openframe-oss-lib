import type { SVGProps } from "react";
export interface TerminalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TerminalIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TerminalIconProps) {
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
        d="M20 16.875a1.125 1.125 0 1 1 0 2.25h-9a1.125 1.125 0 0 1 0-2.25zM3.205 5.205a1.125 1.125 0 0 1 1.505-.078l.085.078 6 6a1.125 1.125 0 0 1 0 1.59l-6 6a1.125 1.125 0 1 1-1.59-1.59L8.409 12 3.205 6.795l-.078-.085a1.125 1.125 0 0 1 .078-1.505"
      />
    </svg>
  );
}
