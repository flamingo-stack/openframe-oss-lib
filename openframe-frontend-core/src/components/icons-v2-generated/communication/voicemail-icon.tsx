import type { SVGProps } from "react";
export interface VoicemailIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VoicemailIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: VoicemailIconProps) {
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
        d="M18 14.875a1.125 1.125 0 0 1 0 2.25H6a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M8.875 12a2.875 2.875 0 1 0-5.75 0 2.875 2.875 0 0 0 5.75 0m12 0a2.875 2.875 0 1 0-5.75 0 2.875 2.875 0 0 0 5.75 0m-9.75 0a5.125 5.125 0 1 1-10.25 0 5.125 5.125 0 0 1 10.25 0m12 0a5.125 5.125 0 1 1-10.25 0 5.125 5.125 0 0 1 10.25 0"
      />
    </svg>
  );
}
