import type { SVGProps } from "react";
export interface RecordingIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RecordingIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: RecordingIconProps) {
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
        d="M10.875 18V6a1.125 1.125 0 0 1 2.25 0v12a1.125 1.125 0 0 1-2.25 0m-9-4v-4a1.125 1.125 0 1 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m18 0v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m-4.5 7V3a1.125 1.125 0 0 1 2.25 0v18a1.125 1.125 0 0 1-2.25 0m-9-8v-2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
