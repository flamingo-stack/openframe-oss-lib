import type { SVGProps } from "react";
export interface ShapeSquareDashIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ShapeSquareDashIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ShapeSquareDashIconProps) {
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
        d="M1.875 18a1.125 1.125 0 0 1 2.25 0c0 .97.738 1.769 1.683 1.865l.192.01.116.006a1.125 1.125 0 0 1 0 2.238L6 22.125l-.422-.022A4.125 4.125 0 0 1 1.875 18m12.124 1.875.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-3.998a1.125 1.125 0 0 1 0-2.25zM19.875 18a1.125 1.125 0 0 1 2.25 0A4.125 4.125 0 0 1 18 22.125a1.125 1.125 0 0 1 0-2.25c1.035 0 1.875-.84 1.875-1.875m-18-4v-4a1.125 1.125 0 1 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m18 0v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m-18-8A4.125 4.125 0 0 1 6 1.875a1.125 1.125 0 0 1 0 2.25c-1.036 0-1.875.84-1.875 1.875a1.125 1.125 0 0 1-2.25 0m18 0c0-1.036-.84-1.875-1.875-1.875a1.125 1.125 0 0 1 0-2.25A4.125 4.125 0 0 1 22.125 6a1.125 1.125 0 0 1-2.25 0m-5.876-4.125.116.006a1.125 1.125 0 0 1 0 2.238L14 4.125h-3.998a1.125 1.125 0 1 1 0-2.25z"
      />
    </svg>
  );
}
