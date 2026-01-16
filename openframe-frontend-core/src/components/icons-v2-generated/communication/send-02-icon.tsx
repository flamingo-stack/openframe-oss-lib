import type { SVGProps } from "react";
export interface Send02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Send02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Send02IconProps) {
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
        d="m12 10.875.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H5.6a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M2.11 6.111C1.043 3.502 3.78.901 6.33 2.225l14.406 7.483c1.852.961 1.852 3.623 0 4.585L6.33 21.774c-2.549 1.324-5.286-1.277-4.22-3.886l2.276-5.575.047-.154a.8.8 0 0 0 0-.32l-.047-.153zm3.183-1.89c-.634-.329-1.398.31-1.1 1.04l2.276 5.574.1.285a3.1 3.1 0 0 1 0 1.76l-.1.284-2.277 5.576c-.297.729.467 1.368 1.1 1.038L19.7 12.296a.337.337 0 0 0 0-.592L5.293 4.222Z"
      />
    </svg>
  );
}
