import type { SVGProps } from "react";
export interface HeadingIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HeadingIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HeadingIconProps) {
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
        d="M16.875 20v-6.876h-9.75V20a1.125 1.125 0 0 1-2.25 0V4a1.125 1.125 0 0 1 2.25 0v6.874h9.75V4a1.125 1.125 0 0 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
