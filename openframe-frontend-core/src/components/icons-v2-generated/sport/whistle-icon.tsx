import type { SVGProps } from "react";
export interface WhistleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WhistleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: WhistleIconProps) {
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
        d="M3.125 15a4.875 4.875 0 1 0 9.75 0c0-.621.504-1.125 1.125-1.125h3a3.87 3.87 0 0 0 3.869-3.75h-3.267l-.517.776a1.63 1.63 0 0 1-1.352.724h-2.465c-.476 0-.923-.208-1.23-.563l-.123-.16-.517-.777H8A4.875 4.875 0 0 0 3.125 15m20-5A6.125 6.125 0 0 1 17 16.126h-1.964A7.126 7.126 0 1 1 8 7.875h3.732c.476 0 .923.208 1.23.563l.123.16.517.777h1.797l.517-.776.122-.162a1.63 1.63 0 0 1 1.23-.562H21.5c.897 0 1.624.727 1.625 1.625z"
      />
      <path
        fill={color}
        d="M8.875 15a.876.876 0 1 0-1.75 0 .876.876 0 0 0 1.75 0m1.08-12.045a1.124 1.124 0 0 1 1.505-.078l.086.078 1.25 1.25.077.085a1.125 1.125 0 0 1-1.583 1.583l-.085-.078-1.25-1.25-.078-.086a1.124 1.124 0 0 1 .078-1.504m7.5 0a1.125 1.125 0 1 1 1.59 1.59l-1.249 1.25-.086.078a1.126 1.126 0 0 1-1.506-1.668zM13.375 4V2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m-2.25 11a3.126 3.126 0 1 1-6.251-.002 3.126 3.126 0 0 1 6.252.003Z"
      />
    </svg>
  );
}
