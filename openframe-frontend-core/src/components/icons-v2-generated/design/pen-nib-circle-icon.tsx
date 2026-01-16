import type { SVGProps } from "react";
export interface PenNibCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PenNibCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PenNibCircleIconProps) {
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
        d="M10.6 6.565c.614-1.063 2.187-1.063 2.8 0l.117.244 1.782 4.638c.65.173 1.189.647 1.436 1.288l.055.165 2.047 6.96.028.111a1.125 1.125 0 0 1-2.148.633l-.038-.11-2.021-6.869H9.342l-2.02 6.869-.038.11a1.126 1.126 0 0 1-2.122-.744L7.21 12.9l.057-.165A2.13 2.13 0 0 1 8.7 11.447l1.784-4.638.117-.244Zm.538 4.81h1.725L12 9.133z"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
    </svg>
  );
}
