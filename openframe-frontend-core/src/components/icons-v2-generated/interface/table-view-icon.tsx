import type { SVGProps } from "react";
export interface TableViewIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TableViewIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: TableViewIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      viewBox="0 0 21 22"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path d="M9.625 20v-4.875H1.75a1.125 1.125 0 0 1 0-2.25h7.875v-3.75H1.75a1.125 1.125 0 0 1 0-2.25h7.875V2a1.125 1.125 0 0 1 2.25 0v4.875h7.875a1.125 1.125 0 0 1 0 2.25h-7.875v3.75h7.875a1.125 1.125 0 0 1 0 2.25h-7.875V20a1.125 1.125 0 0 1-2.25 0" />
      <path d="M18.625 5c0-1.036-.84-1.875-1.875-1.875h-12c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12a4.125 4.125 0 0 1-4.125 4.125h-12A4.125 4.125 0 0 1 .625 17V5A4.125 4.125 0 0 1 4.75.875h12A4.125 4.125 0 0 1 20.875 5z" />
    </svg>
  );
}
