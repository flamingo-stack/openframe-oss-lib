import type { SVGProps } from "react";
export interface Expand04IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Expand04Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Expand04IconProps) {
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
        d="M15.205 15.205a1.124 1.124 0 0 1 1.504-.078l.087.078 3.079 3.08V17a1.125 1.125 0 0 1 2.25 0v4c0 .621-.504 1.125-1.125 1.125h-4a1.125 1.125 0 0 1 0-2.25h1.284l-3.079-3.08-.078-.086a1.124 1.124 0 0 1 .078-1.504M1.875 7V3c0-.621.504-1.125 1.125-1.125h4l.115.006a1.126 1.126 0 0 1 0 2.238L7 4.125H5.716l3.079 3.08.078.086A1.124 1.124 0 0 1 7.29 8.873l-.087-.078-3.079-3.08V7a1.125 1.125 0 0 1-2.25 0Zm5.329 8.205a1.125 1.125 0 1 1 1.59 1.59l-3.078 3.08H7l.115.006a1.125 1.125 0 0 1 0 2.238L7 22.125H3A1.125 1.125 0 0 1 1.875 21v-4a1.125 1.125 0 0 1 2.25 0v1.284l3.08-3.079ZM22.125 7a1.125 1.125 0 0 1-2.25 0V5.716l-3.08 3.079a1.125 1.125 0 1 1-1.59-1.59l3.08-3.08H17a1.125 1.125 0 0 1 0-2.25h4c.621 0 1.125.504 1.125 1.125z"
      />
    </svg>
  );
}
