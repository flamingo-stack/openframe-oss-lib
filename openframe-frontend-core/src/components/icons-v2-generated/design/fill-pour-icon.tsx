import type { SVGProps } from "react";
export interface FillPourIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FillPourIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FillPourIconProps) {
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
        d="m20.495 12.375.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H3.507a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M5.846 2.031a4.01 4.01 0 0 1 5.635 0l9.015 8.936a3.803 3.803 0 0 1 0 5.41l-5.546 5.496a4.33 4.33 0 0 1-6.09 0l-5.216-5.17a4.263 4.263 0 0 1 0-6.064l2.61-2.59-.408-.404a3.947 3.947 0 0 1 0-5.614m-.618 10.206c-.8.793-.8 2.076 0 2.87l5.215 5.167a2.083 2.083 0 0 0 2.924 0l5.546-5.496c.617-.612.617-1.6 0-2.213l-7.01-6.946zm4.67-8.608a1.76 1.76 0 0 0-2.467 0 1.696 1.696 0 0 0 0 2.417l.422.42 2.452-2.432z"
      />
    </svg>
  );
}
