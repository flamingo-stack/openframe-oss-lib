import type { SVGProps } from "react";
export interface BikeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BikeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BikeIconProps) {
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
        d="M13.522 2.875c1.394 0 2.62.924 3.004 2.265l.214.744 2.591 9.057.027.111a1.125 1.125 0 0 1-2.152.617l-.038-.11-1.81-6.325L12 15.764a1.13 1.13 0 0 1-1 .611H5.75a1.125 1.125 0 0 1 0-2.25h4.563l2.058-4H7.856l.271 1.38a1.126 1.126 0 0 1-2.209.433l-.844-4.313H4.5a1.125 1.125 0 0 1 0-2.25h3l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005h-.133l.05.25h6.11l.927-1.802-.09-.314a.876.876 0 0 0-.842-.634h-1.023a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M8.375 15.25a2.625 2.625 0 1 0-5.25 0 2.625 2.625 0 0 0 5.25 0m12.5 0a2.625 2.625 0 1 0-5.25 0 2.625 2.625 0 0 0 5.25 0m-10.25 0a4.875 4.875 0 1 1-9.75 0 4.875 4.875 0 0 1 9.75 0m12.5 0a4.875 4.875 0 1 1-9.75 0 4.875 4.875 0 0 1 9.75 0"
      />
    </svg>
  );
}
