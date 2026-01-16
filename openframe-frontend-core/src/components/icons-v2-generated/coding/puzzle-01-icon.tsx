import type { SVGProps } from "react";
export interface Puzzle01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Puzzle01Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Puzzle01IconProps) {
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
        d="M16.875 19v-2.5c0-.62.504-1.124 1.125-1.124h1.5a1.375 1.375 0 0 0 0-2.752H18a1.125 1.125 0 0 1-1.125-1.125V9c0-1.035-.84-1.874-1.874-1.875H12.5A1.125 1.125 0 0 1 11.375 6V4.5a1.376 1.376 0 0 0-2.75 0V6c0 .621-.504 1.125-1.125 1.125H5c-1.036 0-1.875.84-1.875 1.875v.375H3.5a3.625 3.625 0 1 1 0 7.25h-.375V19c0 1.035.84 1.875 1.875 1.875h2.375V20.5a3.625 3.625 0 0 1 7.25 0v.375h.376c1.035 0 1.874-.84 1.874-1.875m-3.25-14.125h1.376A4.125 4.125 0 0 1 19.125 9v1.374h.375a3.625 3.625 0 0 1 0 7.251h-.375V19a4.125 4.125 0 0 1-4.124 4.125h-1.5A1.125 1.125 0 0 1 12.376 22v-1.5a1.375 1.375 0 0 0-2.751 0V22c0 .62-.504 1.125-1.125 1.125H5A4.125 4.125 0 0 1 .875 19v-3.5c0-.621.504-1.125 1.125-1.125h1.5a1.376 1.376 0 0 0 0-2.75H2a1.125 1.125 0 0 1-1.125-1.124V9A4.125 4.125 0 0 1 5 4.874h1.375V4.5a3.625 3.625 0 1 1 7.25 0z"
      />
    </svg>
  );
}
