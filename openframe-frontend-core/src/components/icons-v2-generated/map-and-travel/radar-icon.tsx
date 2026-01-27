import type { SVGProps } from "react";
export interface RadarIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RadarIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: RadarIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 1-9.332-8.863l.458-.012.114-.005a1.126 1.126 0 0 0 0-2.239L12 .875l-.573.015C5.55 1.188.875 6.048.875 12c0 6.144 4.981 11.125 11.126 11.125 6.143 0 11.124-4.982 11.124-11.126 0-3.071-1.246-5.854-3.258-7.866a1.125 1.125 0 0 0-1.591 1.591A8.84 8.84 0 0 1 20.875 12m-4.5 0a4.375 4.375 0 1 1-4.6-4.369L12 7.625l.114-.005a1.126 1.126 0 0 0 0-2.239L12 5.375l-.342.01a6.625 6.625 0 1 0 5.026 1.93 1.126 1.126 0 0 0-1.59 1.59A4.36 4.36 0 0 1 16.374 12Z"
      />
      <path
        fill={color}
        d="M12.217 14.115a2.126 2.126 0 0 0 1.852-2.593l7.727-7.727.076-.085a1.125 1.125 0 0 0-1.582-1.582l-.085.076-7.727 7.727a2.126 2.126 0 0 0-2.593 1.852l-.01.216.01.219a2.126 2.126 0 0 0 2.116 1.907z"
      />
    </svg>
  );
}
