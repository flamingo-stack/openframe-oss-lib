import type { SVGProps } from "react";
export interface FireExtinguisherIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FireExtinguisherIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FireExtinguisherIconProps) {
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
        d="m14 16.875.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H6a1.125 1.125 0 0 1 0-2.25zM8.875 8.5V5.718a6.876 6.876 0 0 0-5.75 6.782v.5a1.125 1.125 0 0 1-2.25 0v-.5c0-4.658 3.491-8.5 8-9.054V2a1.125 1.125 0 0 1 2.25 0v1.375h4.874l.116.006a1.125 1.125 0 0 1 0 2.239L16 5.625h-4.876V8.5a1.125 1.125 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M21.814.89A1.127 1.127 0 0 1 23.125 2v5a1.126 1.126 0 0 1-1.31 1.11l-4.747-.791a2.625 2.625 0 0 1-2.193-2.59v-.458c0-1.284.928-2.378 2.193-2.589zm-8.94 11.61a2.876 2.876 0 0 0-5.749 0v8.375h5.75zm2.25 8.5c0 1.174-.95 2.124-2.123 2.125H7A2.125 2.125 0 0 1 4.874 21v-8.5a5.126 5.126 0 0 1 10.25 0zm2.001-16.27c0 .183.133.34.314.37l3.436.573V3.33l-3.435.57a.375.375 0 0 0-.314.37v.458Z"
      />
    </svg>
  );
}
