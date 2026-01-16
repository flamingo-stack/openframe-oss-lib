import type { SVGProps } from "react";
export interface RecordingCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RecordingCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: RecordingCircleIconProps) {
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
        d="M10.876 16V8a1.125 1.125 0 0 1 2.25 0v8a1.125 1.125 0 0 1-2.25 0m3.998-2v-4a1.126 1.126 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m-7.999-1.5v-1a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
