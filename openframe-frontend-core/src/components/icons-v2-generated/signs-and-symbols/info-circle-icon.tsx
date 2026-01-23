import type { SVGProps } from "react";
export interface InfoCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function InfoCircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: InfoCircleIconProps) {
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
        d="M12.01 10.375c.62 0 1.124.504 1.124 1.125v3.384a1.124 1.124 0 0 1-.019 2.235l-.116.006H11a1.125 1.125 0 0 1-.116-2.244v-2.442a1.122 1.122 0 0 1 .615-2.064zM13.373 8a1.374 1.374 0 0 1-2.742.141l-.007-.14.007-.141A1.375 1.375 0 0 1 12 6.625l.14.007A1.375 1.375 0 0 1 13.373 8"
      />
    </svg>
  );
}
