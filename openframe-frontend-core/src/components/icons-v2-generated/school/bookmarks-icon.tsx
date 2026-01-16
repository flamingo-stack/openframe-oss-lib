import type { SVGProps } from "react";
export interface BookmarksIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BookmarksIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BookmarksIconProps) {
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
        d="M18.875 9c0-1.036-.84-1.875-1.875-1.875h-6c-1.035 0-1.875.84-1.875 1.875v11.725l4.14-3.576.167-.12c.408-.24.934-.2 1.303.12l4.14 3.576zm2.25 11.998c0 1.763-2.005 2.735-3.382 1.713l-.132-.105-3.61-3.12-3.612 3.12c-1.376 1.189-3.514.212-3.514-1.608V9A4.125 4.125 0 0 1 11 4.875h6A4.125 4.125 0 0 1 21.125 9z"
      />
      <path
        fill={color}
        d="M2.875 18V9A8.126 8.126 0 0 1 11.001.875h6l.114.006a1.125 1.125 0 0 1 0 2.238L17 3.125h-6A5.876 5.876 0 0 0 5.125 9v9a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
