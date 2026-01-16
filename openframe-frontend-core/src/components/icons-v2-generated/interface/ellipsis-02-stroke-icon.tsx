import type { SVGProps } from "react";
export interface Ellipsis02StrokeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Ellipsis02StrokeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Ellipsis02StrokeIconProps) {
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
        d="M12.876 20a.876.876 0 1 0-1.752.002.876.876 0 0 0 1.752-.002m2.25 0a3.126 3.126 0 1 1-6.25 0 3.126 3.126 0 0 1 6.25 0m-2.25-8a.876.876 0 1 0-1.75 0 .876.876 0 0 0 1.75 0m0-8a.876.876 0 1 0-1.752.002A.876.876 0 0 0 12.876 4m2.25 8a3.126 3.126 0 1 1-6.252-.002 3.126 3.126 0 0 1 6.252.003Zm0-8a3.126 3.126 0 1 1-6.25 0 3.126 3.126 0 0 1 6.25 0"
      />
    </svg>
  );
}
