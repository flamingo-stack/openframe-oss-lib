import type { SVGProps } from "react";
export interface Arrow01RightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Arrow01RightIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Arrow01RightIconProps) {
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
        d="m19 10.875.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H5a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M12.205 5.205a1.126 1.126 0 0 1 1.505-.078l.085.078 6 6a1.124 1.124 0 0 1 0 1.59l-6 6a1.125 1.125 0 1 1-1.59-1.59L17.409 12l-5.204-5.205-.078-.085a1.125 1.125 0 0 1 .078-1.505"
      />
    </svg>
  );
}
