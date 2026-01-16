import type { SVGProps } from "react";
export interface MobilePhoneLockIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MobilePhoneLockIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MobilePhoneLockIconProps) {
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
        d="M.875 19V5A4.125 4.125 0 0 1 5 .875h6q.18 0 .356.015l.35.045.113.025a1.126 1.126 0 0 1-.383 2.206l-.114-.013-.158-.02A2 2 0 0 0 11 3.124H5c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h6c1.036 0 1.875-.84 1.875-1.875v-5.102a1.125 1.125 0 0 1 2.25 0V19A4.125 4.125 0 0 1 11 23.125H5A4.125 4.125 0 0 1 .875 19"
      />
      <path
        fill={color}
        d="m9 17.875.115.005a1.125 1.125 0 0 1 0 2.239L9 20.125H7a1.125 1.125 0 0 1 0-2.25zm6.126-9h3.75v-1.75h-3.75zm2.499-5.125a.625.625 0 1 0-1.25 0v1.125h1.25zm2.25 1.314A2.12 2.12 0 0 1 21.125 7v2A2.125 2.125 0 0 1 19 11.124h-4A2.124 2.124 0 0 1 12.875 9V7c0-.862.512-1.602 1.249-1.936V3.75a2.876 2.876 0 0 1 5.75 0z"
      />
    </svg>
  );
}
