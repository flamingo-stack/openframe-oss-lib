import type { SVGProps } from "react";
export interface Numer9CircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Numer9CircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Numer9CircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M13.125 10.25a1.125 1.125 0 0 0-2.25 0v.25a1.125 1.125 0 0 0 2.25 0zm-3.756 3.77a1.125 1.125 0 0 1 1.562.3l-1.862 1.264a1.126 1.126 0 0 1 .3-1.563Zm6.006-.27A3.383 3.383 0 0 1 12 17.124a3.59 3.59 0 0 1-2.931-1.541l.931-.632.93-.633c.218.32.642.555 1.07.555.62 0 1.125-.514 1.125-1.125v-.071a3.4 3.4 0 0 1-1.125.197A3.375 3.375 0 0 1 8.625 10.5v-.251a3.375 3.375 0 1 1 6.75 0z"
      />
    </svg>
  );
}
