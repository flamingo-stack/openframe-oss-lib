import type { SVGProps } from "react";
export interface DotsLoaderIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DotsLoaderIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DotsLoaderIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <circle
        cx={4}
        cy={12}
        r={3}
        className="dots-loader_svg__ods-dots-loader-dot"
      />
      <circle
        cx={12}
        cy={12}
        r={3}
        className="dots-loader_svg__ods-dots-loader-dot"
      />
      <circle
        cx={20}
        cy={12}
        r={3}
        className="dots-loader_svg__ods-dots-loader-dot"
      />
    </svg>
  );
}
