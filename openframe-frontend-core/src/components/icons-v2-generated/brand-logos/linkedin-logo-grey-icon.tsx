import type { SVGProps } from "react";
export interface LinkedinLogoGreyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LinkedinLogoGreyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LinkedinLogoGreyIconProps) {
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
        d="M20.522 2.04c.816 0 1.478.64 1.478 1.427v17.066c0 .788-.662 1.427-1.479 1.427H3.48C2.663 21.96 2 21.32 2 20.533V3.467l.008-.146c.075-.719.705-1.281 1.47-1.281zm-5.097 7.492c-1.588 0-2.3.87-2.698 1.48v-1.27H9.734c.04.837 0 8.878 0 8.968h2.993v-5.007c0-.268.02-.536.098-.727.216-.536.71-1.091 1.536-1.091 1.083 0 1.516.822 1.516 2.028v4.797h2.993v-5.142c0-2.754-1.476-4.036-3.445-4.036M5.085 18.71h2.993V9.742H5.085zM6.602 5.419c-1.024 0-1.693.67-1.693 1.55 0 .86.65 1.549 1.654 1.549h.019c1.043 0 1.693-.689 1.693-1.55-.02-.88-.65-1.55-1.673-1.55"
      />
    </svg>
  );
}
