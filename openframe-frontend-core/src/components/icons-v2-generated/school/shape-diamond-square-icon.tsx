import type { SVGProps } from "react";
export interface ShapeDiamondSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ShapeDiamondSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ShapeDiamondSquareIconProps) {
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
        d="M9.398 1.8a4.124 4.124 0 0 1 5.518.282l7.002 7.004.282.312a4.124 4.124 0 0 1-.282 5.518l-7.002 7.002a4.124 4.124 0 0 1-5.518.282l-.312-.282-7.004-7.002a4.123 4.123 0 0 1 0-5.83l7.004-7.004.312-.283Zm3.927 1.873a1.874 1.874 0 0 0-2.649 0l-7.003 7.003a1.873 1.873 0 0 0 0 2.649l7.003 7.002a1.873 1.873 0 0 0 2.649 0l7.002-7.002.129-.142c.56-.687.56-1.678 0-2.364l-.13-.143z"
      />
    </svg>
  );
}
