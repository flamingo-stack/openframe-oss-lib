import type { SVGProps } from "react";
export interface TrolleyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TrolleyIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TrolleyIconProps) {
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
        d="m3.21 1.894.112.028.491.146A3.13 3.13 0 0 1 5.997 4.52l2.064 11.71a3.63 3.63 0 0 1 1.715 1.727l11.03-1.941a1.124 1.124 0 1 1 .389 2.215L10.056 20.19a3.624 3.624 0 1 1-4.328-4.232L3.78 4.911a.88.88 0 0 0-.497-.643l-.114-.044-.492-.146-.109-.038a1.126 1.126 0 0 1 .64-2.146ZM5.124 19.5a1.375 1.375 0 1 0 2.75 0 1.375 1.375 0 0 0-2.75 0"
      />
      <path
        fill={color}
        d="M15.252 3.342a4.125 4.125 0 0 1 4.778 3.346l.6 3.39.05.42a4.126 4.126 0 0 1-3.398 4.36l-3.386.597a4.126 4.126 0 0 1-4.78-3.346l-.598-3.391a4.125 4.125 0 0 1 3.346-4.779zm2.563 3.737a1.875 1.875 0 0 0-2.172-1.52l-3.388.597a1.874 1.874 0 0 0-1.52 2.17l.597 3.392a1.876 1.876 0 0 0 2.172 1.522l3.389-.598a1.875 1.875 0 0 0 1.52-2.172z"
      />
    </svg>
  );
}
