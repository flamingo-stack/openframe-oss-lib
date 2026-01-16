import type { SVGProps } from "react";
export interface ProgressIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ProgressIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ProgressIconProps) {
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
        d="M19.875 17c0-1.035-.84-1.874-1.875-1.874H6a1.875 1.875 0 0 0 0 3.75h12c1.035 0 1.875-.84 1.875-1.876m0-10c0-1.036-.84-1.875-1.875-1.875H6a1.875 1.875 0 0 0 0 3.75h12c1.035 0 1.875-.84 1.875-1.875m2.25 10A4.125 4.125 0 0 1 18 21.125H6a4.125 4.125 0 0 1 0-8.25h12A4.125 4.125 0 0 1 22.125 17m0-10A4.125 4.125 0 0 1 18 11.125H6a4.125 4.125 0 0 1 0-8.25h12A4.125 4.125 0 0 1 22.125 7"
      />
      <path
        fill={color}
        d="m15 15.876.116.005a1.125 1.125 0 0 1 0 2.239l-.116.005H6a1.125 1.125 0 0 1 0-2.25zM10 5.875l.115.006a1.125 1.125 0 0 1 0 2.238L10 8.125H6a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
