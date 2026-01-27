import type { SVGProps } from "react";
export interface EmailOpenIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EmailOpenIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EmailOpenIconProps) {
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
        d="M.875 19V9a1.125 1.125 0 0 1 2.25 0v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875V9a1.125 1.125 0 0 1 2.25 0v10A4.125 4.125 0 0 1 19 23.125H5A4.125 4.125 0 0 1 .875 19"
      />
      <path
        fill={color}
        d="M20.875 8.75c0-.333-.153-.645-.41-.848l-.116-.08-7.385-4.432a1.88 1.88 0 0 0-1.7-.116l-.229.116-7.384 4.431a1.083 1.083 0 0 0 0 1.858l7.384 4.43a1.88 1.88 0 0 0 1.93 0l7.384-4.43.117-.081c.256-.204.409-.515.409-.848m2.25 0c0 1.17-.614 2.255-1.618 2.858l-7.385 4.431a4.13 4.13 0 0 1-3.995.138l-.25-.138-7.383-4.431a3.334 3.334 0 0 1 0-5.716l7.384-4.431.249-.138a4.13 4.13 0 0 1 3.995.138l7.385 4.431.183.119a3.33 3.33 0 0 1 1.434 2.739Z"
      />
    </svg>
  );
}
