import type { SVGProps } from "react";
export interface SearchClassicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SearchClassicIcon({
  className = "",
  size = 24,
  color = "var(--color-text-secondary)",
  ...props
}: SearchClassicIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 22 22"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M5.548 14.861a1.125 1.125 0 1 1 1.59 1.591l-4.343 4.343a1.125 1.125 0 1 1-1.59-1.59z"
      />
      <path
        fill={color}
        d="M18.875 10a6.876 6.876 0 1 0-13.751.002A6.876 6.876 0 0 0 18.875 10m2.25 0a9.126 9.126 0 1 1-18.25 0 9.126 9.126 0 0 1 18.25 0"
      />
    </svg>
  );
}
