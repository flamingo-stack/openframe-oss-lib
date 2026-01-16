import type { SVGProps } from "react";
export interface ImageXmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ImageXmarkIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ImageXmarkIconProps) {
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
        d="M12.66 11.265a2.126 2.126 0 0 1 2.681 0l.161.147 6.043 6.04.076.087a1.126 1.126 0 0 1-1.582 1.582l-.086-.076-5.954-5.955-2.997 2.999a2.125 2.125 0 0 1-2.843.145l-.161-.145-.498-.498-3.458 3.458a1.125 1.125 0 1 1-1.591-1.59l3.546-3.547.161-.146a2.13 2.13 0 0 1 2.684 0l.16.146.498.497 2.998-2.997zM9 6.875a2.126 2.126 0 1 1-2.114 2.342L6.875 9l.011-.218A2.125 2.125 0 0 1 9 6.875"
      />
      <path
        fill={color}
        d="M1.875 18V6A4.125 4.125 0 0 1 6 1.875h7.13l.114.006a1.126 1.126 0 0 1 0 2.239l-.115.005H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.036.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875v-7.129a1.125 1.125 0 0 1 2.25 0v7.13A4.125 4.125 0 0 1 18 22.124H6A4.125 4.125 0 0 1 1.875 18m19.33-16.795a1.125 1.125 0 0 1 1.59 1.59L21.092 4.5l1.705 1.705.076.087a1.124 1.124 0 0 1-1.582 1.582l-.085-.078L19.5 6.09l-1.705 1.705a1.125 1.125 0 1 1-1.59-1.59l1.703-1.706-1.704-1.704-.076-.085a1.125 1.125 0 0 1 1.582-1.583l.085.078L19.5 2.908z"
      />
    </svg>
  );
}
