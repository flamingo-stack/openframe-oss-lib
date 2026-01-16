import type { SVGProps } from "react";
export interface HeadphoneIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HeadphoneIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HeadphoneIconProps) {
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
        d="M19.875 17v-5a7.875 7.875 0 0 0-15.75 0v5a1.125 1.125 0 0 1-2.25 0v-5C1.875 6.408 6.408 1.875 12 1.875S22.125 6.408 22.125 12v5a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19.875 17c0-1.036-.84-1.875-1.875-1.875h-.875v4.75H18c1.035 0 1.875-.84 1.875-1.875zm-15.75 1c0 1.036.84 1.875 1.875 1.875h.875v-4.75H6A1.875 1.875 0 0 0 4.125 17zm18 0A4.125 4.125 0 0 1 18 22.125h-1A2.125 2.125 0 0 1 14.876 20v-5c0-1.173.95-2.125 2.124-2.125h1A4.125 4.125 0 0 1 22.125 17zm-13 2A2.125 2.125 0 0 1 7 22.125H6A4.125 4.125 0 0 1 1.875 18v-1A4.125 4.125 0 0 1 6 12.875h1c1.174 0 2.125.952 2.125 2.126z"
      />
    </svg>
  );
}
