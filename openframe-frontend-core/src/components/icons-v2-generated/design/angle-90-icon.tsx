import type { SVGProps } from "react";
export interface Angle90IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Angle90Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Angle90IconProps) {
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
        d="M19.085 16.7a1.126 1.126 0 0 1-2.17.6zm-2.41-3.075c.53-.243 1.15-.04 1.439.452l.052.103.267.615q.383.932.652 1.906L18 17l-1.084.3a15 15 0 0 0-.564-1.651l-.232-.533-.042-.109c-.183-.54.068-1.14.597-1.383Zm-4.61-5.231a1.125 1.125 0 0 1 1.493-.21l.092.07.557.488q.82.75 1.537 1.603a1.125 1.125 0 0 1-1.724 1.447 15 15 0 0 0-1.332-1.39l-.482-.423-.085-.078a1.126 1.126 0 0 1-.056-1.507M7.19 4.89l.111.025.645.192q.639.205 1.26.46l.615.268.102.053a1.125 1.125 0 0 1-.932 2.035l-.106-.043-.533-.232a15 15 0 0 0-1.093-.398L6.7 7.084l-.11-.037a1.125 1.125 0 0 1 .599-2.156Z"
      />
      <path
        fill={color}
        d="M1.875 18V3a1.125 1.125 0 0 1 2.25 0v15c0 1.035.84 1.875 1.875 1.875h15a1.125 1.125 0 0 1 0 2.25H6A4.125 4.125 0 0 1 1.875 18"
      />
    </svg>
  );
}
