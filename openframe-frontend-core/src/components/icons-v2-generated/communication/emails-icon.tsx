import type { SVGProps } from "react";
export interface EmailsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EmailsIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: EmailsIconProps) {
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
        d="M20.875 10c0-1.035-.84-1.875-1.875-1.875H9c-1.035 0-1.875.84-1.875 1.876V18c0 1.035.84 1.875 1.875 1.875h10c1.035 0 1.875-.84 1.875-1.875zm-20 9v-9A8.126 8.126 0 0 1 9 1.876h9l.115.006a1.125 1.125 0 0 1 0 2.238L18 4.125H9a5.876 5.876 0 0 0-5.876 5.876v9a1.125 1.125 0 0 1-2.25 0Zm22.25-1A4.125 4.125 0 0 1 19 22.125H9A4.125 4.125 0 0 1 4.875 18v-8A4.125 4.125 0 0 1 9 5.876h10a4.125 4.125 0 0 1 4.125 4.126z"
      />
      <path
        fill={color}
        d="M20.875 9.92c0-.99-.804-1.795-1.795-1.795H8.92c-.99 0-1.795.804-1.795 1.796 0 .283.146.547.387.697l5.494 3.434c.608.38 1.38.38 1.988 0l5.495-3.434.085-.061a.82.82 0 0 0 .301-.636Zm2.25 0c0 .994-.48 1.92-1.28 2.495l-.164.11-5.495 3.435a4.13 4.13 0 0 1-4.117.147l-.255-.147-5.495-3.435a3.07 3.07 0 0 1-1.444-2.604 4.046 4.046 0 0 1 4.046-4.046H19.08a4.046 4.046 0 0 1 4.046 4.046Z"
      />
    </svg>
  );
}
