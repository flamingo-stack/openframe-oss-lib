import type { SVGProps } from "react";
export interface TerminalMonitorIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TerminalMonitorIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TerminalMonitorIconProps) {
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
        d="M10.874 17a1.126 1.126 0 0 1 2.25 0v2.875H16l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H8a1.125 1.125 0 0 1 0-2.25h2.874zM6.204 6.705a1.125 1.125 0 0 1 1.506-.078l.085.078 2.25 2.25a1.125 1.125 0 0 1 0 1.59l-2.25 2.25a1.125 1.125 0 1 1-1.59-1.59L7.659 9.75 6.205 8.295l-.078-.085a1.125 1.125 0 0 1 .078-1.505ZM17 10.875l.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H13a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M20.875 6c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.874 1.875 1.874h14a1.875 1.875 0 0 0 1.875-1.875zm2.25 8A4.125 4.125 0 0 1 19 18.124H5a4.125 4.125 0 0 1-4.125-4.126V6A4.125 4.125 0 0 1 5 1.875h14A4.125 4.125 0 0 1 23.125 6z"
      />
    </svg>
  );
}
