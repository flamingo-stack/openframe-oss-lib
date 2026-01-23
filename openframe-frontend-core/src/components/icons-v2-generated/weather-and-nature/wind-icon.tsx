import type { SVGProps } from "react";
export interface WindIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WindIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: WindIconProps) {
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
        d="M19.875 9.5c0-.759-.616-1.375-1.375-1.375H17a1.125 1.125 0 0 1 0-2.25h1.5a3.626 3.626 0 0 1 0 7.25H3a1.125 1.125 0 0 1 0-2.25h15.5c.759 0 1.375-.615 1.375-1.375"
      />
      <path
        fill={color}
        d="M16.875 18.5c0-.76-.616-1.375-1.376-1.375H3a1.125 1.125 0 0 1 0-2.25h12.5a3.625 3.625 0 1 1 0 7.25H14a1.125 1.125 0 0 1 0-2.25h1.5c.759 0 1.375-.616 1.375-1.375m-5-13c0-.759-.616-1.375-1.375-1.375H9a1.125 1.125 0 0 1 0-2.25h1.5a3.626 3.626 0 0 1 0 7.25H3a1.125 1.125 0 0 1 0-2.25h7.5c.76 0 1.375-.615 1.376-1.375Z"
      />
    </svg>
  );
}
