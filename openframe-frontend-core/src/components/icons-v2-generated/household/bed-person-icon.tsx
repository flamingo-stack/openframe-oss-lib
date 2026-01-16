import type { SVGProps } from "react";
export interface BedPersonIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BedPersonIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BedPersonIconProps) {
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
        d="M20.875 18v-3A2.876 2.876 0 0 0 18 12.126h-6.875V18a1.125 1.125 0 0 1-2.25 0v-6c0-1.173.952-2.125 2.126-2.125H18a5.126 5.126 0 0 1 5.125 5.126v3a1.125 1.125 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M20.875 21v-1.875H3.125V21a1.125 1.125 0 0 1-2.25 0V7a1.125 1.125 0 0 1 2.25 0v8.876H22c.62 0 1.125.503 1.125 1.124v4a1.125 1.125 0 0 1-2.25 0M6 12.876a.125.125 0 0 0-.125.124l.01.048a.125.125 0 0 0 .23 0l.01-.048-.01-.048a.13.13 0 0 0-.066-.068zM8.125 13a2.125 2.125 0 0 1-4.24.217L3.875 13l.01-.217A2.127 2.127 0 0 1 6 10.874l.217.012A2.125 2.125 0 0 1 8.125 13"
      />
    </svg>
  );
}
