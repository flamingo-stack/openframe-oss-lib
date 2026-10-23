import type { SVGProps } from "react";
export interface MonitorShieldIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MonitorShieldIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MonitorShieldIconProps) {
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
        d="M10.876 17a1.125 1.125 0 0 1 2.25 0v2.875H16l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005H8a1.125 1.125 0 0 1 0-2.25h2.876zM20.9 4.385l-2.374-1.188-2.375 1.188v1.738l.015.168c.07.407.39.906.977 1.45.471.436 1 .794 1.383 1.027a9 9 0 0 0 1.383-1.027c.672-.621.991-1.185.991-1.618zm2.25 1.738-.01.262c-.105 1.297-.975 2.335-1.704 3.009a11 11 0 0 1-1.748 1.3l-.396.232c-.418.232-.912.26-1.35.086l-.182-.086c-.417-.232-1.327-.774-2.146-1.532-.728-.674-1.597-1.712-1.702-3.01l-.01-.261V3.999c0-.616.347-1.178.897-1.454l3-1.5.175-.074a1.63 1.63 0 0 1 1.104 0l.174.074 3 1.5.197.116c.435.3.701.799.701 1.338z"
      />
      <path
        fill={color}
        d="M.853 14V6a4.15 4.15 0 0 1 4.15-4.15h5.959a1.15 1.15 0 0 1 0 2.3h-5.96A1.85 1.85 0 0 0 3.154 6v8a1.85 1.85 0 0 0 1.85 1.85H19A1.85 1.85 0 0 0 20.85 14v-.998a1.15 1.15 0 0 1 2.3 0V14A4.15 4.15 0 0 1 19 18.15H5.003A4.15 4.15 0 0 1 .853 14"
      />
    </svg>
  );
}
