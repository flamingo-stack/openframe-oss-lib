import type { SVGProps } from "react";
export interface SignMaleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SignMaleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SignMaleIconProps) {
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
        d="M10.874 22v-.875H10a1.125 1.125 0 0 1 0-2.25h.874V16a1.125 1.125 0 0 1 2.25 0v2.875h.877l.114.006a1.126 1.126 0 0 1 0 2.239l-.114.005h-.877V22a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M17.875 9a5.875 5.875 0 1 0-11.75 0 5.875 5.875 0 0 0 11.75 0m2.25 0a8.125 8.125 0 1 1-16.249-.002A8.125 8.125 0 0 1 20.123 9Z"
      />
    </svg>
  );
}
