import type { SVGProps } from "react";
export interface RouteXmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RouteXmarkIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: RouteXmarkIconProps) {
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
        d="M18.875 15.75a2.625 2.625 0 0 0-2.625-2.625h-8.5a4.875 4.875 0 1 1 0-9.75h5.115l.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006H7.75a2.625 2.625 0 1 0 0 5.25h8.5a4.875 4.875 0 0 1 0 9.75H8a1.125 1.125 0 0 1 0-2.25h8.25a2.625 2.625 0 0 0 2.625-2.625"
      />
      <path
        fill={color}
        d="M6.875 19.5a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m13.33-18.296a1.125 1.125 0 1 1 1.59 1.591L20.09 4.5l1.705 1.705.078.086a1.125 1.125 0 0 1-1.583 1.582l-.085-.077L18.5 6.09l-1.704 1.705a1.125 1.125 0 1 1-1.59-1.591l1.703-1.705-1.704-1.704-.078-.085a1.125 1.125 0 0 1 1.582-1.583l.087.077L18.5 2.909zM9.125 19.5a3.624 3.624 0 1 1-7.249 0 3.624 3.624 0 0 1 7.249 0"
      />
    </svg>
  );
}
