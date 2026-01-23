import type { SVGProps } from "react";
export interface ChartLineUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChartLineUpIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChartLineUpIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M15.705 8.705a1.125 1.125 0 1 1 1.59 1.59l-2.698 2.699a2.125 2.125 0 0 1-2.436.405l-.16-.086-1.078-.646-2.628 2.628a1.125 1.125 0 1 1-1.59-1.59l2.698-2.698.133-.123a2.13 2.13 0 0 1 2.303-.284l.16.088 1.076.644z"
      />
    </svg>
  );
}
