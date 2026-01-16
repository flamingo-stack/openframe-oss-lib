import type { SVGProps } from "react";
export interface Menu02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Menu02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Menu02IconProps) {
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
        d="m13 16.875.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H3a1.125 1.125 0 0 1 0-2.25zm8-6a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25zm0-6a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
