import type { SVGProps } from "react";
export interface EmailBannedIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EmailBannedIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EmailBannedIconProps) {
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
        d="M20.875 11.872V5c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h6.01l.114.006a1.126 1.126 0 0 1 0 2.239l-.114.005H5a4.125 4.125 0 0 1-4.125-4.124V5A4.125 4.125 0 0 1 5 .875h14A4.125 4.125 0 0 1 23.125 5v6.872a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20.875 18.5a2.374 2.374 0 0 0-3.058-2.275l2.956 2.956c.065-.216.102-.444.102-.681m0-13.5c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v.318c0 .319.174.612.453.766l7.519 4.135.215.101c.515.204 1.1.17 1.592-.1l7.518-4.136.1-.064a.87.87 0 0 0 .353-.702zm-4.75 13.5a2.374 2.374 0 0 0 3.056 2.273l-2.956-2.956q-.099.326-.1.683m7 0a4.624 4.624 0 1 1-9.249 0 4.624 4.624 0 0 1 9.249 0m0-13.182c0 1.14-.62 2.189-1.62 2.738l-7.517 4.135a4.13 4.13 0 0 1-3.975 0l-7.52-4.135A3.13 3.13 0 0 1 .876 5.318V5A4.125 4.125 0 0 1 5 .875h14A4.125 4.125 0 0 1 23.125 5z"
      />
    </svg>
  );
}
