import type { SVGProps } from "react";
export interface BedBunkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BedBunkIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BedBunkIconProps) {
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
        d="M18.875 19v-1c0-1.035-.84-1.875-1.875-1.875H2a1.125 1.125 0 0 1 0-2.25h15A4.125 4.125 0 0 1 21.125 18v1a1.125 1.125 0 0 1-2.25 0m0-9V9c0-1.036-.84-1.875-1.875-1.875H2a1.125 1.125 0 0 1 0-2.25h15A4.125 4.125 0 0 1 21.125 9v1a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20.875 22v-1.875H3.125V22a1.125 1.125 0 0 1-2.25 0V2a1.125 1.125 0 0 1 2.25 0v6.875h17.75V6a1.125 1.125 0 0 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0m-17.75-4.125h17.75v-6.75H3.125z"
      />
    </svg>
  );
}
