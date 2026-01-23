import type { SVGProps } from "react";
export interface RssIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RssIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: RssIconProps) {
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
        d="M5.217 16.886A2.125 2.125 0 1 1 5 16.875zM11.875 20a7.877 7.877 0 0 0-7.484-7.866L4 12.126l-.116-.006A1.126 1.126 0 0 1 4 9.875l.502.012A10.127 10.127 0 0 1 14.125 20a1.125 1.125 0 0 1-2.25 0m7 0A14.88 14.88 0 0 0 4.738 5.143L4 5.125l-.116-.006A1.125 1.125 0 0 1 4 2.875l.85.02A17.127 17.127 0 0 1 21.125 20a1.126 1.126 0 0 1-2.25 0"
      />
    </svg>
  );
}
