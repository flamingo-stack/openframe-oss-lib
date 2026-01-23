import type { SVGProps } from "react";
export interface EmailLockIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EmailLockIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EmailLockIconProps) {
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
        d="M20.875 10.848V5c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h7.104l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H5a4.125 4.125 0 0 1-4.125-4.124V5A4.125 4.125 0 0 1 5 .875h14A4.125 4.125 0 0 1 23.125 5v5.848a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M17.125 20.875h3.75v-1.75h-3.75zM20.875 5c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v.318c0 .319.174.612.453.766l7.519 4.135.215.101c.515.204 1.1.17 1.592-.1l7.518-4.136.1-.064a.87.87 0 0 0 .353-.702zm-1.25 10.75a.626.626 0 0 0-1.25 0v1.125h1.25zm2.25 1.314A2.12 2.12 0 0 1 23.125 19v2A2.125 2.125 0 0 1 21 23.125h-4A2.125 2.125 0 0 1 14.874 21v-2c0-.862.515-1.602 1.251-1.936v-1.313a2.875 2.875 0 1 1 5.75 0zm1.25-11.746c0 1.14-.62 2.189-1.62 2.738l-7.517 4.135a4.13 4.13 0 0 1-3.975 0l-7.52-4.135A3.13 3.13 0 0 1 .876 5.318V5A4.125 4.125 0 0 1 5 .875h14A4.125 4.125 0 0 1 23.125 5z"
      />
    </svg>
  );
}
