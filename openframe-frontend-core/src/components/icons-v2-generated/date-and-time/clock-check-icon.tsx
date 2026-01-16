import type { SVGProps } from "react";
export interface ClockCheckIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ClockCheckIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ClockCheckIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-9.331 8.863l.457.012.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006-.573-.015C5.55 22.812.875 17.953.875 12 .875 5.857 5.857.876 12.001.876s11.124 4.981 11.124 11.126q0 .849-.123 1.667l-.024.112a1.125 1.125 0 0 1-2.201-.448l.042-.327a9 9 0 0 0 .056-1.005Z"
      />
      <path
        fill={color}
        d="M21.204 16.705a1.125 1.125 0 0 1 1.59 1.59l-4.5 4.5c-.438.44-1.15.44-1.59 0l-2-2-.077-.086a1.125 1.125 0 0 1 1.583-1.582l.085.078L17.5 20.41l3.705-3.704ZM10.875 8.5a1.125 1.125 0 0 1 2.25 0v3.034l1.67 1.671.078.085a1.126 1.126 0 0 1-1.582 1.582l-.086-.076-2-2.001a1.13 1.13 0 0 1-.33-.796z"
      />
    </svg>
  );
}
