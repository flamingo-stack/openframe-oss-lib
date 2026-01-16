import type { SVGProps } from "react";
export interface BellExclamationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BellExclamationIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BellExclamationIconProps) {
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
        d="M18.377 9.5a6.375 6.375 0 0 0-12.75 0v3.631c0 .94-.321 1.848-.903 2.575l-.265.302-.224.23a.375.375 0 0 0 .268.637H19.5c.29 0 .456-.306.337-.541l-.067-.096-.226-.23a4.13 4.13 0 0 1-1.168-2.877zm2.25 3.631c0 .489.19.958.53 1.309l.225.23c1.619 1.663.44 4.455-1.882 4.455H4.503c-2.321 0-3.5-2.792-1.882-4.456l.225-.23.12-.137c.265-.331.41-.744.41-1.17V9.5a8.625 8.625 0 0 1 17.25 0z"
      />
      <path
        fill={color}
        d="m14 20.875.115.006a1.126 1.126 0 0 1 0 2.239l-.114.005H10a1.125 1.125 0 0 1 0-2.25zm-3.126-10.874V6a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0Zm2.501 3.998a1.376 1.376 0 0 1-2.742.141l-.007-.14.007-.141A1.374 1.374 0 0 1 12 12.626l.14.007c.694.07 1.235.655 1.235 1.367Z"
      />
    </svg>
  );
}
