import type { SVGProps } from "react";
export interface CodingMergeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CodingMergeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CodingMergeIconProps) {
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
        d="M4.375 8v8a1.125 1.125 0 0 0 2.25 0v-3.33a4.1 4.1 0 0 0 1.875.454H15l.115-.005a1.125 1.125 0 0 0 0-2.239L15 10.874H8.5A1.875 1.875 0 0 1 6.625 9V8l-.006-.115A1.125 1.125 0 0 0 4.375 8"
      />
      <path
        fill={color}
        d="M6.875 5.5a1.374 1.374 0 1 1-2.749 0 1.374 1.374 0 0 1 2.749 0m12 6.5a1.375 1.375 0 1 1-2.75.001 1.375 1.375 0 0 1 2.75-.001m-12 6.5a1.375 1.375 0 1 1-2.75 0 1.375 1.375 0 0 1 2.75 0m2.25-13a3.625 3.625 0 1 0-7.25 0 3.625 3.625 0 0 0 7.25 0m12 6.5a3.625 3.625 0 1 0-7.25-.001 3.625 3.625 0 0 0 7.25.001m-12 6.5a3.624 3.624 0 1 0-7.249 0 3.624 3.624 0 0 0 7.249 0"
      />
    </svg>
  );
}
