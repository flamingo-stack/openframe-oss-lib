import type { SVGProps } from "react";
export interface ArrowTurnRightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowTurnRightIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ArrowTurnRightIconProps) {
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
        d="M2.875 20v-4A7.125 7.125 0 0 1 10 8.875h11l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H10A4.875 4.875 0 0 0 5.125 16v4a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M14.205 3.205a1.125 1.125 0 0 1 1.505-.078l.085.078 6 6a1.124 1.124 0 0 1 0 1.59l-6 6a1.125 1.125 0 1 1-1.59-1.59L19.409 10l-5.204-5.205-.078-.085a1.125 1.125 0 0 1 .078-1.505"
      />
    </svg>
  );
}
