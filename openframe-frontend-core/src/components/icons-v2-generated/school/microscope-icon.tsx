import type { SVGProps } from "react";
export interface MicroscopeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MicroscopeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MicroscopeIconProps) {
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
        d="m12 16.875.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H6a1.125 1.125 0 0 1 0-2.25zm.124-3.374c0 .897-.727 1.624-1.624 1.624h-3a1.625 1.625 0 0 1-1.625-1.624V10a1.125 1.125 0 0 1 2.25 0v2.875h1.75V10c0-.621.504-1.125 1.124-1.125q.222.002.415.082A1.121 1.121 0 0 1 12 6.875h1a8.125 8.125 0 0 1 0 16.25h-1a1.125 1.125 0 0 1 0-2.25h1a5.874 5.874 0 0 0 0-11.75h-1c-.145 0-.282-.03-.409-.08.32.2.533.55.534.955z"
      />
      <path
        fill={color}
        d="m20 20.875.115.005a1.126 1.126 0 0 1 0 2.239l-.114.006H4a1.125 1.125 0 0 1 0-2.25zm-12.875-12h3.75v-5.75h-3.75zm6 .125a2.123 2.123 0 0 1-2.124 2.124H7A2.125 2.125 0 0 1 4.875 9V3C4.875 1.827 5.826.875 7 .875h4c1.174 0 2.124.952 2.124 2.125z"
      />
    </svg>
  );
}
