import type { SVGProps } from "react";
export interface XSmallIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function XSmallIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: XSmallIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M13.916 8A5.917 5.917 0 1 0 2.083 8a5.917 5.917 0 0 0 11.833 0m1.5 0A7.417 7.417 0 1 1 .583 7.999 7.417 7.417 0 0 1 15.417 8"
      />
      <path
        fill={color}
        d="M9.803 5.136a.75.75 0 0 1 1.061 1.06L9.06 8l1.804 1.804.05.057a.75.75 0 0 1-1.054 1.054l-.057-.05L8 9.06l-1.803 1.804a.75.75 0 0 1-1.06-1.06l1.802-1.805-1.803-1.802-.051-.057A.75.75 0 0 1 6.14 5.084l.057.052L8 6.94z"
      />
    </svg>
  );
}
