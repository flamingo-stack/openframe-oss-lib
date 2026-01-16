import type { SVGProps } from "react";
export interface MobilePhoneIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MobilePhoneIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MobilePhoneIconProps) {
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
        d="M16.875 5c0-1.036-.84-1.875-1.875-1.875H9c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h6c1.035 0 1.875-.84 1.875-1.875zm2.25 14A4.125 4.125 0 0 1 15 23.125H9A4.125 4.125 0 0 1 4.875 19V5A4.125 4.125 0 0 1 9 .875h6A4.125 4.125 0 0 1 19.125 5z"
      />
      <path
        fill={color}
        d="m13 17.875.115.006a1.125 1.125 0 0 1 0 2.238l-.116.006H11a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
