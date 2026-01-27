import type { SVGProps } from "react";
export interface SocketIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SocketIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SocketIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M9.391 10.632a1.375 1.375 0 1 1-.14-.008zm5.5 0a1.375 1.375 0 1 1-1.508 1.509L13.376 12l.007-.14a1.375 1.375 0 0 1 1.367-1.236zM10.874 7.5v-.243a4.874 4.874 0 0 0 0 9.485V16.5a1.125 1.125 0 1 1 2.25 0v.242a4.874 4.874 0 0 0 0-9.485V7.5a1.125 1.125 0 0 1-2.25 0m8.25 4.5a7.125 7.125 0 1 1-14.25 0 7.125 7.125 0 0 1 14.25 0"
      />
    </svg>
  );
}
