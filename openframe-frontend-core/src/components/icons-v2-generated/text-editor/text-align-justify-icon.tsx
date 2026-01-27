import type { SVGProps } from "react";
export interface TextAlignJustifyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TextAlignJustifyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TextAlignJustifyIconProps) {
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
        d="m21 18.375.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H3a1.125 1.125 0 0 1 0-2.25zm0-10a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25zm0 5.001.116.005a1.125 1.125 0 0 1 0 2.239l-.116.006H3a1.125 1.125 0 0 1 0-2.25zm0-10.001a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
