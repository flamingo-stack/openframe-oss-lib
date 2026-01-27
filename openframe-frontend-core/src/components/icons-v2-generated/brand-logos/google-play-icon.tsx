import type { SVGProps } from "react";
export interface GooglePlayIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GooglePlayIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GooglePlayIconProps) {
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
        d="M3.209 1.968a1.125 1.125 0 0 1 1.507.03l.08.081 7.125 8.205 3.197-3.68.079-.083a1.126 1.126 0 0 1 1.619 1.558L13.41 12l3.403 3.919.07.09a1.125 1.125 0 0 1-1.689 1.468l-.08-.082-3.195-3.68-7.122 8.204-.08.083a1.125 1.125 0 0 1-1.62-1.558L10.429 12 3.096 3.557l-.07-.09a1.125 1.125 0 0 1 .182-1.498Z"
      />
      <path
        fill={color}
        d="M1.877 5.005c0-3.183 3.453-5.167 6.203-3.564l11.995 6.993c2.73 1.591 2.73 5.536 0 7.128L8.08 22.555c-2.75 1.603-6.203-.381-6.203-3.564zm2.25 13.986c0 1.447 1.57 2.349 2.82 1.62l11.994-6.993c1.241-.723 1.241-2.517 0-3.24L6.947 3.385c-1.25-.73-2.82.173-2.82 1.62V18.99Z"
      />
    </svg>
  );
}
