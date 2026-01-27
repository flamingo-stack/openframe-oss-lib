import type { SVGProps } from "react";
export interface Logout01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Logout01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Logout01IconProps) {
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
        d="M1.875 18V6A4.125 4.125 0 0 1 6 1.875h4l.115.006a1.125 1.125 0 0 1 0 2.238L10 4.125H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h4l.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H6A4.125 4.125 0 0 1 1.875 18"
      />
      <path
        fill={color}
        d="M15.204 17.795a1.126 1.126 0 0 0 1.506.078l.085-.078 5-5c.44-.438.44-1.15 0-1.59l-5-5a1.125 1.125 0 0 0-1.59 1.59l3.08 3.08H11a1.125 1.125 0 0 0 0 2.25h7.285l-3.08 3.08-.077.085a1.125 1.125 0 0 0 .076 1.505"
      />
    </svg>
  );
}
