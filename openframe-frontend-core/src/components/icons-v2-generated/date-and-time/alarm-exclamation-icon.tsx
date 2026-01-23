import type { SVGProps } from "react";
export interface AlarmExclamationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlarmExclamationIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlarmExclamationIconProps) {
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
        d="M5.205 19.205a1.125 1.125 0 0 1 1.59 1.59l-2 2a1.125 1.125 0 1 1-1.59-1.59zm12 0a1.124 1.124 0 0 1 1.504-.078l.087.078 2 2 .077.086a1.125 1.125 0 0 1-1.584 1.582l-.084-.078-2-2-.078-.085a1.125 1.125 0 0 1 .078-1.505m-13-18a1.125 1.125 0 1 1 1.59 1.59l-3 3a1.125 1.125 0 1 1-1.59-1.59zm14 0a1.126 1.126 0 0 1 1.505-.078l.085.078 3 3 .077.085a1.125 1.125 0 0 1-1.581 1.583l-.087-.078-3-3-.076-.085a1.125 1.125 0 0 1 .076-1.505Z"
      />
      <path
        fill={color}
        d="M19.875 13a7.875 7.875 0 1 0-15.75 0 7.875 7.875 0 0 0 15.75 0m-7.734 2.632a1.376 1.376 0 1 1-1.51 1.51L10.625 17l.008-.14A1.375 1.375 0 0 1 12 15.625zM10.875 13V9a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 1 1-2.25 0m11.25 0c0 5.592-4.533 10.125-10.125 10.125S1.875 18.592 1.875 13 6.408 2.875 12 2.875 22.125 7.408 22.125 13"
      />
    </svg>
  );
}
