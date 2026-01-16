import type { SVGProps } from "react";
export interface TextAlignRightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TextAlignRightIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TextAlignRightIconProps) {
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
        d="m21 10.624.116-.005a1.125 1.125 0 0 0 0-2.239L21 8.375H9a1.125 1.125 0 0 0 0 2.25zm0 10.001a1.125 1.125 0 0 0 0-2.25H9a1.125 1.125 0 0 0 0 2.25zm0-15 .116-.006a1.125 1.125 0 0 0 0-2.239L21 3.375H3a1.125 1.125 0 0 0 0 2.25zm0 10a1.125 1.125 0 0 0 0-2.25H3a1.125 1.125 0 0 0 0 2.25z"
      />
    </svg>
  );
}
