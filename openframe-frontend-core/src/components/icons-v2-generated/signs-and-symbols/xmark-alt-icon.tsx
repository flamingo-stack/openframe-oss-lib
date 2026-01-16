import type { SVGProps } from "react";
export interface XmarkAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function XmarkAltIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: XmarkAltIconProps) {
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
        d="M1.875 18v-2a1.125 1.125 0 0 1 2.25 0v2c0 1.035.84 1.875 1.875 1.875h2l.115.006a1.125 1.125 0 0 1 0 2.238L8 22.125H6A4.125 4.125 0 0 1 1.875 18m18 0v-2a1.125 1.125 0 0 1 2.25 0v2A4.125 4.125 0 0 1 18 22.125h-2a1.125 1.125 0 0 1 0-2.25h2c1.035 0 1.875-.84 1.875-1.875m-18-10V6A4.125 4.125 0 0 1 6 1.875h2l.115.006a1.125 1.125 0 0 1 0 2.238L8 4.125H6c-1.036 0-1.875.84-1.875 1.875v2a1.125 1.125 0 0 1-2.25 0m18 0V6c0-1.036-.84-1.875-1.875-1.875h-2a1.125 1.125 0 0 1 0-2.25h2A4.125 4.125 0 0 1 22.125 6v2a1.125 1.125 0 0 1-2.25 0m-5.17-.295a1.125 1.125 0 0 1 1.59 1.59L13.59 12l2.706 2.706.076.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076L12 13.59l-2.704 2.706a1.125 1.125 0 0 1-1.59-1.59l2.704-2.707-2.704-2.704-.078-.085A1.125 1.125 0 0 1 9.21 7.627l.085.078L12 10.409z"
      />
    </svg>
  );
}
