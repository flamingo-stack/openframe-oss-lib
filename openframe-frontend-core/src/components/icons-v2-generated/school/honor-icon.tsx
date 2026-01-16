import type { SVGProps } from "react";
export interface HonorIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HonorIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HonorIconProps) {
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
        d="M2.875 14.904V2a1.125 1.125 0 0 1 2.25 0v12.904c0 .943.462 1.827 1.238 2.364l4.854 3.362a1.38 1.38 0 0 0 1.566 0l4.853-3.362a2.88 2.88 0 0 0 1.24-2.364V2a1.125 1.125 0 0 1 2.25 0v12.904a5.13 5.13 0 0 1-1.956 4.027l-.252.187-4.854 3.362a3.63 3.63 0 0 1-4.128 0l-4.853-3.362a5.13 5.13 0 0 1-2.208-4.214"
      />
      <path
        fill={color}
        d="m15 12.875.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H9a1.125 1.125 0 0 1 0-2.25zm0-5 .115.006a1.126 1.126 0 0 1 0 2.239l-.114.006H9a1.125 1.125 0 0 1 0-2.25h6Zm7-7 .115.006a1.125 1.125 0 0 1 0 2.238L22 3.125H2a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
