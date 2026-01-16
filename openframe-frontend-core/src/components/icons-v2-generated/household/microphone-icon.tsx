import type { SVGProps } from "react";
export interface MicrophoneIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MicrophoneIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MicrophoneIconProps) {
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
        d="M7.56 11.745a1.125 1.125 0 0 1 1.759 1.403l-3.112 3.894a1.252 1.252 0 0 0 1.754 1.763l3.931-3.112a1.125 1.125 0 0 1 1.398 1.763L9.358 20.57h-.001a3.5 3.5 0 0 1-3.613.443 3.95 3.95 0 0 1-4.14.857 1.125 1.125 0 1 1 .793-2.105 1.7 1.7 0 0 0 1.698-.296 3.5 3.5 0 0 1 .356-3.832l3.11-3.891Z"
      />
      <path
        fill={color}
        d="M20.875 10a5.85 5.85 0 0 1-1.4 3.802 12.5 12.5 0 0 1-5.179-3.098 12.5 12.5 0 0 1-3.098-5.18A5.874 5.874 0 0 1 20.875 10m-11.75 0c0-.821.168-1.603.472-2.312a14.6 14.6 0 0 0 3.107 4.607 14.6 14.6 0 0 0 4.608 3.107A5.876 5.876 0 0 1 9.125 10m14 0A8.124 8.124 0 0 0 9.109 4.408l-.026.028A8.1 8.1 0 0 0 6.875 10a8.126 8.126 0 0 0 8.126 8.125c2.153 0 4.11-.84 5.563-2.207l.028-.027A8.1 8.1 0 0 0 23.125 10"
      />
    </svg>
  );
}
