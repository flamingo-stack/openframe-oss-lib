import type { SVGProps } from "react";
export interface PaperclipVrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PaperclipVrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PaperclipVrIconProps) {
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
        d="M4.875 15V6a1.125 1.125 0 0 1 2.25 0v9l.006.25a4.876 4.876 0 0 0 9.744-.25V7a2.876 2.876 0 0 0-5.75 0v8a.874.874 0 1 0 1.75 0V7a1.125 1.125 0 0 1 2.25 0v8a3.124 3.124 0 1 1-6.25 0V7a5.125 5.125 0 1 1 10.25 0v8a7.125 7.125 0 0 1-14.241.366z"
      />
    </svg>
  );
}
