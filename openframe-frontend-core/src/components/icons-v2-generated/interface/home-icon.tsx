import type { SVGProps } from "react";
export interface HomeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HomeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HomeIconProps) {
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
        d="M19.875 10.5c0-.59-.278-1.146-.75-1.5l-6-4.5c-.667-.5-1.583-.5-2.25 0l-6 4.5c-.472.354-.75.91-.75 1.5V18c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 7.5A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18v-7.5c0-1.298.61-2.521 1.65-3.3l6-4.5a4.13 4.13 0 0 1 4.95 0l6 4.5a4.13 4.13 0 0 1 1.65 3.3z"
      />
    </svg>
  );
}
