import type { SVGProps } from "react";
export interface VideoRecorderIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VideoRecorderIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: VideoRecorderIconProps) {
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
        d="m8 7.875.115.006a1.125 1.125 0 0 1 0 2.238L8 10.125H6a1.125 1.125 0 1 1 0-2.25zm15.125 9.19c0 1.298-1.447 2.072-2.526 1.352l-5.223-3.482-.092-.067a1.126 1.126 0 0 1 1.24-1.863l.1.058 4.252 2.833V8.102l-4.252 2.834a1.125 1.125 0 0 1-1.247-1.872l5.222-3.482.206-.117c1.049-.503 2.32.253 2.32 1.47z"
      />
      <path
        fill={color}
        d="M14.874 8a1.874 1.874 0 0 0-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.875 1.875 1.875h8c1.035 0 1.874-.84 1.874-1.876zm2.25 8A4.125 4.125 0 0 1 13 20.124H5a4.125 4.125 0 0 1-4.125-4.126V8A4.125 4.125 0 0 1 5 3.875h8A4.125 4.125 0 0 1 17.124 8z"
      />
    </svg>
  );
}
