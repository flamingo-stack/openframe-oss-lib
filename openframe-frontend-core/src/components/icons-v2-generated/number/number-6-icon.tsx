import type { SVGProps } from "react";
export interface Number6IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Number6Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Number6IconProps) {
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
        d="M15.375 15a3.375 3.375 0 0 0-6.75 0v.5a3.375 3.375 0 0 0 6.75 0zm2.25.5a5.625 5.625 0 0 1-11.25 0v-7c0-3.057 2.495-5.625 5.625-5.625 1.85 0 3.63.898 4.723 2.303l.208.288.06.098a1.125 1.125 0 0 1-1.853 1.256l-.07-.091-.127-.174A3.82 3.82 0 0 0 12 5.125c-1.87 0-3.375 1.543-3.375 3.375v1.998a5.625 5.625 0 0 1 9 4.502z"
      />
    </svg>
  );
}
