import type { SVGProps } from "react";
export interface Arrow02DownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Arrow02DownIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Arrow02DownIconProps) {
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
        d="m17 19.875.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H7a1.125 1.125 0 0 1 0-2.25zM10.875 3a1.125 1.125 0 0 1 2.25 0v10.285l3.08-3.08a1.125 1.125 0 0 1 1.59 1.59l-5 5a1.127 1.127 0 0 1-1.59 0l-5-5-.078-.085a1.126 1.126 0 0 1 1.583-1.582l.085.076 3.08 3.08z"
      />
    </svg>
  );
}
