import type { SVGProps } from "react";
export interface SirenIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SirenIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SirenIconProps) {
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
        d="M6.615 16.152a1.125 1.125 0 0 1-2.23-.303zM14.38 3.875a4.125 4.125 0 0 1 4.087 3.568l1.147 8.406a1.125 1.125 0 0 1-2.23.303L16.24 7.747a1.875 1.875 0 0 0-1.858-1.622H9.62c-.937 0-1.732.693-1.859 1.622l-1.145 8.405-1.115-.153-1.115-.15 1.147-8.406.07-.378a4.126 4.126 0 0 1 4.017-3.19h4.762Z"
      />
      <path
        fill={color}
        d="M10.614 12.16a1.126 1.126 0 0 1-2.228-.319l2.228.318ZM8.908 8.227a1.125 1.125 0 0 1 2.206.432l-.5 3.5L9.5 12l-1.114-.159.5-3.5zM19.875 18a.875.875 0 0 0-.875-.875H5a.875.875 0 0 0-.875.875v.875h15.75zm2.25 1.5c0 .897-.727 1.625-1.625 1.625h-17A1.626 1.626 0 0 1 1.875 19.5V18A3.125 3.125 0 0 1 5 14.875h14A3.125 3.125 0 0 1 22.125 18z"
      />
    </svg>
  );
}
