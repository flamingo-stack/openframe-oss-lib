import type { SVGProps } from "react";
export interface CrownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CrownIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CrownIconProps) {
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
        d="m19 16.375.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H5a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M17.875 17.5q0-.163.047-.32l2.58-8.699-3.132 1.493a2.126 2.126 0 0 1-2.816-.968L12 3.895l-2.555 5.11a2.125 2.125 0 0 1-2.616 1.051l-.198-.082L3.496 8.48l2.583 8.7q.045.157.045.32V20c0 .483.393.875.876.875h10a.877.877 0 0 0 .875-.875zm2.25 2.5c0 1.725-1.4 3.125-3.126 3.125H7A3.127 3.127 0 0 1 3.874 20v-2.338L.94 7.777c-.375-1.265.821-2.387 2.02-2.023l.239.094L7.487 7.89l3.06-6.119.124-.21c.638-.917 2.02-.918 2.658-.001l.124.211 3.059 6.119 4.29-2.042.24-.094c1.118-.339 2.233.616 2.072 1.772l-.055.25-2.934 9.886z"
      />
    </svg>
  );
}
