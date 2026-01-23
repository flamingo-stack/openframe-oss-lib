import type { SVGProps } from "react";
export interface DnaIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DnaIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DnaIconProps) {
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
        d="m14.5 19.375.116.005a1.125 1.125 0 0 1 0 2.239l-.116.006H5.09a1.125 1.125 0 0 1 0-2.25zm-2-3.5.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H6.196a1.125 1.125 0 0 1 0-2.25zm5.303-10 .116.005a1.125 1.125 0 0 1 0 2.239l-.116.006H11.5a1.125 1.125 0 0 1 0-2.25zm1.108-3.5.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006H9.5a1.125 1.125 0 0 1 0-2.25h9.41Z"
      />
      <path
        fill={color}
        d="M17.875 22c0-5.615-3.825-7.512-5.876-8.687C9.948 14.488 6.125 16.386 6.125 22a1.125 1.125 0 0 1-2.25 0c0-5.859 3.578-8.636 5.86-10.001C7.454 10.634 3.876 7.858 3.876 2a1.125 1.125 0 0 1 2.25 0c0 5.613 3.822 7.511 5.874 8.687C14.05 9.51 17.875 7.615 17.875 2a1.125 1.125 0 0 1 2.25 0c0 5.86-3.58 8.634-5.863 9.999 2.283 1.364 5.862 4.14 5.863 10a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
