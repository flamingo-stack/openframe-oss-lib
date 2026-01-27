import type { SVGProps } from "react";
export interface BlockQuoteIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BlockQuoteIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BlockQuoteIconProps) {
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
        d="M21 16.875a1.125 1.125 0 0 1 0 2.25H9a1.125 1.125 0 0 1 0-2.25zm0-6a1.125 1.125 0 0 1 0 2.25H9a1.125 1.125 0 0 1 0-2.25zm0-6a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25zM1.875 18v-6a1.125 1.125 0 0 1 2.25 0v6a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
