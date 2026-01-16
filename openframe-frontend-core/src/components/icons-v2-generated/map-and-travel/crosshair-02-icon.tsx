import type { SVGProps } from "react";
export interface Crosshair02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Crosshair02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Crosshair02IconProps) {
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
        d="M10.876 22v-1.45a8.625 8.625 0 0 1-7.426-7.425H2a1.125 1.125 0 0 1 0-2.25h1.45a8.625 8.625 0 0 1 7.425-7.425V2a1.125 1.125 0 0 1 2.25 0v1.45a8.625 8.625 0 0 1 7.424 7.425H22l.116.006a1.125 1.125 0 0 1 0 2.239l-.115.006h-1.45a8.624 8.624 0 0 1-7.425 7.423V22a1.125 1.125 0 0 1-2.25 0M12 5.625a6.375 6.375 0 1 0 0 12.75 6.375 6.375 0 0 0 0-12.75"
      />
      <path
        fill={color}
        d="M13.875 12a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m2.25 0a4.125 4.125 0 1 1-8.25 0 4.125 4.125 0 0 1 8.25 0"
      />
    </svg>
  );
}
