import type { SVGProps } from "react";
export interface AlertDiamondIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlertDiamondIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlertDiamondIconProps) {
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
        d="M9.397 1.8a4.124 4.124 0 0 1 5.519.282l7.002 7.003.282.312a4.124 4.124 0 0 1-.282 5.518l-7.002 7.003a4.124 4.124 0 0 1-5.519.282l-.312-.282-7.003-7.002a4.123 4.123 0 0 1 0-5.83l7.003-7.004zm3.928 1.873a1.874 1.874 0 0 0-2.649 0l-7.003 7.003a1.873 1.873 0 0 0 0 2.649l7.003 7.002a1.873 1.873 0 0 0 2.649 0l7.002-7.002.129-.142c.56-.687.56-1.678 0-2.365l-.13-.142z"
      />
      <path
        fill={color}
        d="M10.876 12V8a1.125 1.125 0 0 1 2.25 0v4a1.126 1.126 0 0 1-2.25 0m2.498 4a1.375 1.375 0 0 1-2.742.14l-.007-.14.007-.141a1.375 1.375 0 0 1 1.369-1.233l.14.007c.693.07 1.233.655 1.233 1.367"
      />
    </svg>
  );
}
