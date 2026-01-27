import type { SVGProps } from "react";
export interface SnorkelIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SnorkelIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SnorkelIconProps) {
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
        d="m12 14.876.115.005a1.126 1.126 0 0 1 0 2.239l-.114.005h-.87A2.873 2.873 0 0 0 14 19.875h4A2.875 2.875 0 0 0 20.875 17V3a1.125 1.125 0 0 1 2.25 0v14A5.125 5.125 0 0 1 18 22.125h-4a5.124 5.124 0 0 1-5.123-5H8a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M8.66 9.765a2.126 2.126 0 0 1 2.681 0l.161.147 1.963 1.962H16a.875.875 0 0 0 .876-.874V8c0-1.035-.84-1.875-1.874-1.875H5c-1.036 0-1.875.84-1.875 1.875v3c0 .483.391.874.875.874h2.534l1.964-1.962.161-.147ZM19.124 11c0 1.726-1.4 3.124-3.126 3.124h-2.585a2.12 2.12 0 0 1-1.346-.48l-.157-.142L10 11.59l-1.912 1.912a2.12 2.12 0 0 1-1.502.622H4A3.125 3.125 0 0 1 .875 11V8A4.125 4.125 0 0 1 5 3.875h10A4.125 4.125 0 0 1 19.126 8v3Z"
      />
    </svg>
  );
}
