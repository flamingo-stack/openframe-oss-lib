import type { SVGProps } from "react";
export interface ChromeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChromeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChromeIconProps) {
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
        d="M14.875 12a2.876 2.876 0 1 0-5.752 0 2.876 2.876 0 0 0 5.752 0m2.25 0a5.1 5.1 0 0 1-.64 2.479q-.01.024-.02.048l-4.221 7.972-.059.1a1.126 1.126 0 0 1-1.929-1.154l2.301-4.352a5.12 5.12 0 0 1-4.98-2.505l-.023-.036-4.502-8-.051-.104a1.124 1.124 0 0 1 1.95-1.097l.061.097 2.401 4.265a5.13 5.13 0 0 1 4.323-2.831l.263-.007h9.169l.116.005a1.126 1.126 0 0 1 0 2.239l-.116.006h-4.925A5.1 5.1 0 0 1 17.125 12"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
    </svg>
  );
}
