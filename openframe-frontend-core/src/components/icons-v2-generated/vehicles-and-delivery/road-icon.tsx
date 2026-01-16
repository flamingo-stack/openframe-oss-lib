import type { SVGProps } from "react";
export interface RoadIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RoadIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: RoadIconProps) {
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
        d="M10.875 21v-1a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0m0-5v-2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m0-6V8a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m0-6V3a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M16.446 1.875c1.43 0 2.676.971 3.028 2.357l3.554 14 .072.369a3.127 3.127 0 0 1-3.102 3.524H4.001a3.125 3.125 0 0 1-3.03-3.894l3.554-14 .076-.254a3.13 3.13 0 0 1 2.954-2.102zm-8.891 2.25a.88.88 0 0 0-.8.52l-.049.14-3.553 14A.875.875 0 0 0 4 19.875h15.997a.876.876 0 0 0 .87-.987l-.021-.103-3.553-14a.875.875 0 0 0-.848-.66z"
      />
    </svg>
  );
}
