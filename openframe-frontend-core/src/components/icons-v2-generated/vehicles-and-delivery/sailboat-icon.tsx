import type { SVGProps } from "react";
export interface SailboatIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SailboatIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SailboatIconProps) {
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
        d="M21.5 15.875a1.626 1.626 0 0 1 1.575 2.027l-.066.201-.72 1.8a5.12 5.12 0 0 1-4.759 3.222H6.475a5.13 5.13 0 0 1-4.6-2.864l-.16-.357-.718-1.8a1.625 1.625 0 0 1 1.508-2.229zM3.805 19.07a2.88 2.88 0 0 0 2.67 1.806H17.53a2.875 2.875 0 0 0 2.67-1.806l.377-.944H3.428zm7.57-16.569c0-1.563 1.967-2.2 2.896-1.014l.086.122 6.574 9.999.116.207c.495 1.047-.262 2.31-1.474 2.31H13a1.625 1.625 0 0 1-1.624-1.625zm2.25 9.374h4.788l-4.788-7.287zm-8.095 0h1.844V8.923zm4.094.625c0 .898-.727 1.625-1.624 1.625H4.402c-1.276 0-2.055-1.404-1.378-2.486L6.62 5.882l.085-.123c.912-1.222 2.918-.597 2.918.984z"
      />
    </svg>
  );
}
