import type { SVGProps } from "react";
export interface Arrow03DownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Arrow03DownIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Arrow03DownIconProps) {
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
        d="m17 19.875.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H7a1.125 1.125 0 0 1 0-2.25zM10.875 16a1.125 1.125 0 0 0 2.25 0V5.715l3.08 3.08a1.125 1.125 0 0 0 1.59-1.59l-5-5a1.127 1.127 0 0 0-1.59 0l-5 5-.078.085A1.126 1.126 0 0 0 7.71 8.872l.085-.076 3.08-3.08z"
      />
    </svg>
  );
}
