import type { SVGProps } from "react";
export interface HomeSmileIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HomeSmileIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HomeSmileIconProps) {
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
        d="M14.53 14.433a1.124 1.124 0 1 1 1.942 1.134 5.17 5.17 0 0 1-4.473 2.558 5.17 5.17 0 0 1-4.294-2.277l-.176-.281-.053-.101a1.125 1.125 0 0 1 1.932-1.13l.063.097.1.157a2.92 2.92 0 0 0 2.428 1.284c1.084 0 2.027-.58 2.53-1.44Z"
      />
      <path
        fill={color}
        d="M19.875 10.5c0-.59-.278-1.146-.75-1.5l-6-4.5c-.667-.5-1.583-.5-2.25 0l-6 4.5c-.472.354-.75.91-.75 1.5V18c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 7.5A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18v-7.5c0-1.298.61-2.521 1.65-3.3l6-4.5a4.13 4.13 0 0 1 4.95 0l6 4.5a4.13 4.13 0 0 1 1.65 3.3z"
      />
    </svg>
  );
}
