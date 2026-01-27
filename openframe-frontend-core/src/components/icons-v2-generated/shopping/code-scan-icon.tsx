import type { SVGProps } from "react";
export interface CodeScanIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CodeScanIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CodeScanIconProps) {
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
        d="M1.875 18v-2a1.125 1.125 0 0 1 2.25 0v2c0 1.035.84 1.875 1.875 1.875h2l.115.006a1.125 1.125 0 0 1 0 2.238L8 22.125H6A4.125 4.125 0 0 1 1.875 18m18 0v-2a1.125 1.125 0 0 1 2.25 0v2A4.125 4.125 0 0 1 18 22.125h-2a1.125 1.125 0 0 1 0-2.25h2c1.035 0 1.875-.84 1.875-1.875m-18-10V6A4.125 4.125 0 0 1 6 1.875h2l.115.006a1.125 1.125 0 0 1 0 2.238L8 4.125H6c-1.036 0-1.875.84-1.875 1.875v2a1.125 1.125 0 0 1-2.25 0m18 0V6c0-1.036-.84-1.875-1.875-1.875h-2a1.125 1.125 0 0 1 0-2.25h2A4.125 4.125 0 0 1 22.125 6v2a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M8.125 15.876h7.75v-2.752h-7.75zm10 .624c0 .897-.727 1.625-1.625 1.625h-9A1.625 1.625 0 0 1 5.875 16.5v-3.376H3a1.125 1.125 0 0 1 0-2.25h18l.116.006a1.126 1.126 0 0 1 0 2.239l-.116.005h-2.875zm0-8.3a1.125 1.125 0 0 1-2.25 0v-.075h-7.75V8.2a1.125 1.125 0 0 1-2.25 0v-.7c0-.898.728-1.625 1.625-1.625h9c.897 0 1.624.727 1.625 1.625z"
      />
    </svg>
  );
}
