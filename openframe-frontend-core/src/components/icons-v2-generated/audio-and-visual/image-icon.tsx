import type { SVGProps } from "react";
export interface ImageIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ImageIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ImageIconProps) {
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
        d="M12.66 11.265a2.13 2.13 0 0 1 2.681 0l.161.146 6.043 6.043.076.085a1.125 1.125 0 0 1-1.582 1.582l-.086-.076-5.954-5.955-2.997 2.999c-.83.83-2.174.829-3.004 0L7.5 15.59l-3.458 3.458a1.125 1.125 0 1 1-1.591-1.59l3.546-3.547.161-.147a2.13 2.13 0 0 1 2.684 0l.16.147.498.497 2.998-2.998.161-.146ZM9 6.875a2.126 2.126 0 1 1-2.114 2.342L6.875 9l.011-.218A2.125 2.125 0 0 1 9 6.875"
      />
      <path
        fill={color}
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
    </svg>
  );
}
