import type { SVGProps } from "react";
export interface VideoRecorderPlayIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VideoRecorderPlayIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: VideoRecorderPlayIconProps) {
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
        d="M5.875 9.564c0-1.276 1.344-2.06 2.435-1.515l.213.128 3.293 2.282a1.875 1.875 0 0 1 0 3.082l-3.293 2.282c-1.119.775-2.648-.026-2.648-1.387zm2.25 3.797L10.091 12l-1.966-1.363zm15 3.704c0 1.298-1.447 2.072-2.527 1.352l-5.222-3.482-.092-.067a1.126 1.126 0 0 1 1.24-1.863l.1.058 4.251 2.833V8.102l-4.251 2.834a1.125 1.125 0 0 1-1.248-1.872l5.222-3.482.207-.117c1.049-.504 2.32.252 2.32 1.47z"
      />
      <path
        fill={color}
        d="M14.874 8a1.874 1.874 0 0 0-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.875 1.875 1.875h8c1.035 0 1.874-.84 1.874-1.876zm2.25 8A4.125 4.125 0 0 1 13 20.124H5a4.125 4.125 0 0 1-4.125-4.126V8A4.125 4.125 0 0 1 5 3.875h8A4.125 4.125 0 0 1 17.124 8z"
      />
    </svg>
  );
}
