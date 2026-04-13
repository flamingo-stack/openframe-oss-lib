import type { SVGProps } from "react";
export interface SlackLogoGreyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SlackLogoGreyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SlackLogoGreyIconProps) {
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
        fillRule="evenodd"
        d="M9.333 2a2 2 0 1 0 0 4h2.001V4a2 2 0 0 0-2.001-2m0 5.333H4a2 2 0 0 0 0 4h5.333a2 2 0 1 0 0-4M22 9.333a2 2 0 0 0-4 0v2h2a2 2 0 0 0 2-2m-5.333 0V4a2 2 0 0 0-4 0v5.333a2 2 0 1 0 4 0M14.666 22a2 2 0 1 0 0-4h-2v2c0 1.103.895 1.998 2 2m0-5.334H20a2 2 0 0 0 0-4h-5.333a2 2 0 0 0 0 4M2 14.666a2 2 0 0 0 4 0v-2H4a2 2 0 0 0-2 2m5.333 0V20a2 2 0 0 0 4 0v-5.332a2 2 0 0 0-4-.002"
        clipRule="evenodd"
      />
    </svg>
  );
}
