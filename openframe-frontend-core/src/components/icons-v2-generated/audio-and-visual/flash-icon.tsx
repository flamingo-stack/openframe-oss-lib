import type { SVGProps } from "react";
export interface FlashIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FlashIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FlashIconProps) {
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
        d="M15.3.875c1.04 0 1.793.955 1.594 1.94l-.053.199-1.787 5.36H19c1.418 0 2.155 1.688 1.193 2.728l-10.64 11.5c-1.152 1.245-3.202.112-2.76-1.527l1.735-6.452H5a1.625 1.625 0 0 1-1.548-2.12l3.36-10.499.098-.241c.274-.539.83-.888 1.449-.888h6.94ZM5.857 12.373h3.486a1.626 1.626 0 0 1 1.569 2.047l-1.29 4.793 7.949-8.59h-3.384a1.625 1.625 0 0 1-1.54-2.138l1.786-5.36H8.815z"
      />
    </svg>
  );
}
