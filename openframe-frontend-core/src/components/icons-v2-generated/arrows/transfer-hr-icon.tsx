import type { SVGProps } from "react";
export interface TransferHrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TransferHrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TransferHrIconProps) {
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
        d="M21 13.875a1.126 1.126 0 0 1 .796 1.92l-5 5a1.125 1.125 0 1 1-1.59-1.59l3.078-3.08H6a1.125 1.125 0 0 1 0-2.25zM7.204 3.205a1.125 1.125 0 0 1 1.591 1.59l-3.08 3.08H18l.116.005a1.126 1.126 0 0 1 0 2.239l-.116.005H3a1.126 1.126 0 0 1-.795-1.92l5-5Z"
      />
    </svg>
  );
}
