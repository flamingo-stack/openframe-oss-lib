import type { SVGProps } from "react";
export interface CalendarArrowLeftIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CalendarArrowLeftIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CalendarArrowLeftIconProps) {
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
        d="M21 6.875a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M18.205 15.204a1.125 1.125 0 0 1 1.59 1.59l-1.079 1.08H22l.115.006a1.126 1.126 0 0 1 0 2.239l-.114.006h-3.285l1.08 1.08.076.086a1.124 1.124 0 0 1-1.582 1.582l-.085-.078-3-3a1.125 1.125 0 0 1 0-1.59l3-3Zm1.67-2.672V6c0-.996-.778-1.81-1.76-1.87a1.124 1.124 0 0 1-2.233-.005H8.118a1.125 1.125 0 0 1-2.235.005A1.874 1.874 0 0 0 4.125 6v12c0 1.036.84 1.875 1.875 1.875h6.532l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H6A4.125 4.125 0 0 1 1.875 18V6a4.12 4.12 0 0 1 4.006-4.119 1.125 1.125 0 0 1 2.237-.006h7.764a1.125 1.125 0 0 1 2.235.006 4.12 4.12 0 0 1 4.008 4.12v6.531a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
