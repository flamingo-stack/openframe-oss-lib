import type { SVGProps } from "react";
export interface BrightnessDownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BrightnessDownIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BrightnessDownIconProps) {
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
        d="M15.876 12a3.876 3.876 0 1 0-7.752.002A3.876 3.876 0 0 0 15.876 12m2.25 0a6.126 6.126 0 1 1-12.25 0 6.126 6.126 0 0 1 12.25 0m-5.986 7.383a1.375 1.375 0 1 1-1.508 1.507l-.008-.14.008-.141A1.375 1.375 0 0 1 12 19.375zm-6.19-2.56a1.375 1.375 0 1 1-1.509 1.508l-.005-.14.005-.141a1.376 1.376 0 0 1 1.369-1.235zm12.381 0a1.375 1.375 0 1 1-1.509 1.508l-.007-.14.007-.141a1.375 1.375 0 0 1 1.368-1.235zm-14.94-6.191a1.375 1.375 0 1 1-.14-.008zm17.5 0a1.375 1.375 0 1 1-1.508 1.509L19.375 12l.008-.14a1.375 1.375 0 0 1 1.367-1.236zM5.95 4.442A1.376 1.376 0 1 1 4.44 5.95l-.005-.14.005-.141a1.375 1.375 0 0 1 1.37-1.233l.14.005Zm12.38 0a1.375 1.375 0 1 1-1.509 1.508l-.007-.14.007-.141a1.375 1.375 0 0 1 1.368-1.233l.141.005ZM12 1.874a1.376 1.376 0 1 1-1.368 1.516l-.008-.14.008-.141A1.375 1.375 0 0 1 12 1.875Z"
      />
    </svg>
  );
}
