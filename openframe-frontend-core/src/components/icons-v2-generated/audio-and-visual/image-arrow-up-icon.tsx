import type { SVGProps } from "react";
export interface ImageArrowUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ImageArrowUpIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ImageArrowUpIconProps) {
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
        d="M12.66 11.265a2.126 2.126 0 0 1 2.681 0l.161.147 6.043 6.04.076.087a1.125 1.125 0 0 1-1.582 1.582l-.086-.076-5.954-5.955-2.997 2.999c-.83.83-2.174.83-3.004 0L7.5 15.59l-3.458 3.458a1.125 1.125 0 1 1-1.591-1.59l3.546-3.547.161-.146a2.13 2.13 0 0 1 2.684 0l.16.146.498.497 2.998-2.997.161-.147ZM9 6.875a2.126 2.126 0 1 1-2.114 2.342l-.011-.216.011-.219A2.125 2.125 0 0 1 9 6.875"
      />
      <path
        fill={color}
        d="M1.875 18V6A4.125 4.125 0 0 1 6 1.875h6.535l.114.006a1.126 1.126 0 0 1 0 2.239l-.114.005H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.036.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875v-6.525a1.125 1.125 0 0 1 2.25 0V18A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18m16-10V4.716l-1.08 1.08a1.125 1.125 0 0 1-1.59-1.591l3-3 .085-.078a1.126 1.126 0 0 1 1.506.078l3 3 .076.085a1.125 1.125 0 0 1-1.582 1.583l-.085-.078-1.08-1.08V8a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
