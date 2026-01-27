import type { SVGProps } from "react";
export interface HeadingAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HeadingAltIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HeadingAltIconProps) {
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
        d="m8 2.875.115.006a1.126 1.126 0 0 1 0 2.238L8 5.125h-.875v5.75h9.75v-5.75H16a1.125 1.125 0 0 1 0-2.25h4l.115.006a1.125 1.125 0 0 1 0 2.238L20 5.125h-.877v13.75H20l.114.006a1.126 1.126 0 0 1 0 2.239l-.114.005h-4a1.125 1.125 0 0 1 0-2.25h.875v-5.75h-9.75v5.75H8l.115.006a1.126 1.126 0 0 1 0 2.239L8 21.125H4a1.125 1.125 0 0 1 0-2.25h.875V5.125H4a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
