import type { SVGProps } from "react";
export interface XmarkCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function XmarkCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: XmarkCircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M14.705 7.705a1.125 1.125 0 0 1 1.59 1.59L13.59 12l2.706 2.706.076.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076L12 13.59l-2.704 2.706a1.125 1.125 0 0 1-1.59-1.59l2.704-2.707-2.704-2.704-.078-.085A1.125 1.125 0 0 1 9.21 7.627l.085.078L12 10.409z"
      />
    </svg>
  );
}
