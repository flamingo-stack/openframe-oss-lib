import type { SVGProps } from "react";
export interface BookIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BookIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BookIconProps) {
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
        d="M18.875 4A.876.876 0 0 0 18 3.125H7c-1.036 0-1.875.84-1.875 1.875v12.002c.278-.081.57-.127.875-.127h12a.877.877 0 0 0 .875-.876zM5.143 20.176a.875.875 0 0 0 .857.699h11.875v-1.75H6a.875.875 0 0 0-.875.875zM21.125 16c0 .904-.386 1.715-1 2.286v2.596a1.126 1.126 0 0 1-.01 2.237l-.114.006H6a3.125 3.125 0 0 1-3.109-2.806L2.875 20V5A4.125 4.125 0 0 1 7 .875h11A3.126 3.126 0 0 1 21.125 4z"
      />
    </svg>
  );
}
