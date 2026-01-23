import type { SVGProps } from "react";
export interface MobilePhoneBannedIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MobilePhoneBannedIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MobilePhoneBannedIconProps) {
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
        d="M.875 19V5A4.125 4.125 0 0 1 5 .875h6a1.125 1.125 0 0 1 0 2.25H5c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h6c1.036 0 1.875-.84 1.875-1.875v-6.07a1.125 1.125 0 0 1 2.25 0V19A4.125 4.125 0 0 1 11 23.125H5A4.125 4.125 0 0 1 .875 19"
      />
      <path
        fill={color}
        d="m9 17.875.115.005a1.125 1.125 0 0 1 0 2.239L9 20.125H7a1.125 1.125 0 0 1 0-2.25zM20.875 6a2.876 2.876 0 0 0-3.95-2.667l3.74 3.741c.134-.332.21-.694.21-1.074m-5.75 0a2.874 2.874 0 0 0 3.95 2.665l-3.74-3.74c-.134.333-.21.695-.21 1.075m8 0a5.125 5.125 0 1 1-10.25-.002A5.125 5.125 0 0 1 23.125 6"
      />
    </svg>
  );
}
