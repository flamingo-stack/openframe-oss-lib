import type { SVGProps } from "react";
export interface HashIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HashIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HashIconProps) {
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
        d="m19.5 14.875.116.005a1.126 1.126 0 0 1 0 2.239l-.116.006H3a1.125 1.125 0 0 1 0-2.25zm1.5-8a1.125 1.125 0 0 1 0 2.25H4.5a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M8.39 2.816a1.126 1.126 0 0 1 2.22.369l-3 18a1.126 1.126 0 0 1-2.22-.37l3-18Zm8 0a1.126 1.126 0 0 1 2.22.369l-3 18-.025.112a1.126 1.126 0 0 1-2.194-.482l3-18Z"
      />
    </svg>
  );
}
