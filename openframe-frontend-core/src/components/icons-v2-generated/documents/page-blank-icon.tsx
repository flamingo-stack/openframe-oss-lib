import type { SVGProps } from "react";
export interface PageBlankIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PageBlankIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PageBlankIconProps) {
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
        d="M21.125 19A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19V5A4.125 4.125 0 0 1 7 .875h6.586c.493 0 .968.172 1.346.482l.157.14 5.414 5.415c.398.398.622.939.622 1.503zm-16 0c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875V8.466l-5.34-5.341H7c-1.036 0-1.875.84-1.875 1.875z"
      />
    </svg>
  );
}
