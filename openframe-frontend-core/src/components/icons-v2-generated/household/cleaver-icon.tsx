import type { SVGProps } from "react";
export interface CleaverIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CleaverIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CleaverIconProps) {
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
        d="M4.977 13.375a1.126 1.126 0 0 1 1.774 1.382l-3.495 4.992a.72.72 0 0 0 .175 1l.128.07a.72.72 0 0 0 .872-.245l3.502-4.99.072-.09a1.125 1.125 0 0 1 1.77 1.382l-3.503 4.991a2.97 2.97 0 0 1-3.875.886l-.256-.16a2.97 2.97 0 0 1-.73-4.135l3.496-4.992zM15.89 4.53a1.375 1.375 0 1 1-1.507 1.509l-.008-.14.008-.141a1.374 1.374 0 0 1 1.366-1.235z"
      />
      <path
        fill={color}
        d="M12.956 1.995a3.23 3.23 0 0 1 4.295-.531l4.947 3.464a2.15 2.15 0 0 1 .756 2.597l-.09.186a64 64 0 0 1-3.735 6.08 63 63 0 0 1-3.596 4.628l-.836.961a2.15 2.15 0 0 1-2.844.324l-6.67-4.671a1.125 1.125 0 0 1-.276-1.567l7.846-11.208zm3.005 1.311a.98.98 0 0 0-1.235.091l-.129.15-7.203 10.287 5.681 3.979a62 62 0 0 0 4.212-5.313 62 62 0 0 0 3.553-5.777z"
      />
    </svg>
  );
}
