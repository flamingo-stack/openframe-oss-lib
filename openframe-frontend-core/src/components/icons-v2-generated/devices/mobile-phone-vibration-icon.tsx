import type { SVGProps } from "react";
export interface MobilePhoneVibrationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MobilePhoneVibrationIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MobilePhoneVibrationIconProps) {
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
        d="M12.219 1.795a4.105 4.105 0 0 1 5.491.283l4.213 4.211.281.312a4.104 4.104 0 0 1-.28 5.492l-9.831 9.83a4.104 4.104 0 0 1-5.492.282l-.312-.282-4.212-4.213a4.104 4.104 0 0 1 0-5.803l9.83-9.83zm3.9 1.873a1.854 1.854 0 0 0-2.622 0l-9.829 9.83a1.854 1.854 0 0 0 0 2.622l4.213 4.212.14.128c.729.593 1.802.55 2.48-.128l9.831-9.83a1.855 1.855 0 0 0 .128-2.48l-.128-.14z"
      />
      <path
        fill={color}
        d="M20.29 16.21a1.125 1.125 0 0 1 1.505 1.668l-3.917 3.917-.086.078a1.126 1.126 0 0 1-1.506-1.669l3.918-3.918zm-14.702-.793a1.124 1.124 0 0 1 1.505-.077l.086.077 1.403 1.404a1.127 1.127 0 0 1-1.59 1.592l-1.404-1.405-.077-.085a1.125 1.125 0 0 1 .077-1.506m.533-13.212a1.125 1.125 0 0 1 1.591 1.59L3.795 7.712a1.125 1.125 0 1 1-1.59-1.59L6.12 2.205Z"
      />
    </svg>
  );
}
