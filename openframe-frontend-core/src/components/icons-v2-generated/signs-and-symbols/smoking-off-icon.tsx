import type { SVGProps } from "react";
export interface SmokingOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SmokingOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SmokingOffIconProps) {
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
        d="M20.875 17v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 1 1-2.25 0m-3-2.662v-.213h-.216a1.126 1.126 0 0 1 0-2.25H19c.622 0 1.126.504 1.126 1.125v1.338a1.125 1.125 0 0 1-2.25 0Zm3-5.338v-.5c0-.759-.615-1.375-1.375-1.375a3.626 3.626 0 0 1-3.625-3.626V3a1.125 1.125 0 1 1 2.25 0v.5c0 .76.616 1.376 1.375 1.376A3.625 3.625 0 0 1 23.125 8.5V9a1.125 1.125 0 0 1-2.25 0M1.205 2.205a1.125 1.125 0 0 1 1.506-.078l.084.078 18 18 .078.085a1.125 1.125 0 0 1-1.583 1.583l-.085-.078-3.671-3.67H3A2.125 2.125 0 0 1 .875 16v-2c0-1.174.952-2.125 2.126-2.125h6.284l-8.08-8.08-.078-.085a1.125 1.125 0 0 1 .078-1.505m8.92 13.67h3.159l-1.75-1.75h-1.409zm-7 0h4.75v-1.75h-4.75z"
      />
    </svg>
  );
}
