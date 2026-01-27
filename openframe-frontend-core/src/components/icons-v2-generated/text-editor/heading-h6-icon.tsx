import type { SVGProps } from "react";
export interface HeadingH6IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HeadingH6Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HeadingH6IconProps) {
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
        d="M20.875 17.5a1.125 1.125 0 0 0-2.25 0v.25a1.125 1.125 0 0 0 2.25 0zm2.25.25a3.375 3.375 0 1 1-6.75 0v-3.5a3.383 3.383 0 0 1 3.375-3.375c1.172 0 2.294.603 2.931 1.543a1.124 1.124 0 0 1-1.862 1.262 1.34 1.34 0 0 0-1.069-.555c-.62 0-1.125.515-1.125 1.125v.07a3.375 3.375 0 0 1 4.5 3.18zM11.874 20v-6.876H3.125V20a1.125 1.125 0 0 1-2.25 0V4a1.125 1.125 0 0 1 2.25 0v6.874h8.75V4a1.125 1.125 0 0 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
