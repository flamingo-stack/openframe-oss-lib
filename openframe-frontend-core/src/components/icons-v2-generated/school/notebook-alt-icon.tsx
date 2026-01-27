import type { SVGProps } from "react";
export interface NotebookAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function NotebookAltIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: NotebookAltIconProps) {
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
        d="M18.875 6c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v13c0 1.036.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 13A4.126 4.126 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19V6A4.125 4.125 0 0 1 7 1.875h10A4.125 4.125 0 0 1 21.125 6z"
      />
      <path
        fill={color}
        d="m13 12.875.115.006a1.125 1.125 0 0 1 0 2.238l-.116.006H8a1.125 1.125 0 0 1 0-2.25zm3-4 .115.005a1.125 1.125 0 0 1 0 2.239l-.115.005H8a1.125 1.125 0 0 1 0-2.25zM6.874 4V2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m4 0V2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m4 0V2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
