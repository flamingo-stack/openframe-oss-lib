import type { SVGProps } from "react";
export interface BellCheckIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BellCheckIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BellCheckIconProps) {
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
        d="M18.376 9.5a6.375 6.375 0 1 0-12.75 0v3.631c0 .94-.32 1.848-.902 2.575l-.265.302-.224.23a.375.375 0 0 0 .268.637H19.5c.29 0 .456-.306.337-.541l-.067-.096-.226-.23a4.13 4.13 0 0 1-1.168-2.877zm2.25 3.631c0 .489.19.958.53 1.309l.226.23c1.619 1.663.44 4.455-1.882 4.455H4.503c-2.321 0-3.5-2.792-1.882-4.456l.225-.23.12-.137c.265-.331.41-.744.41-1.17V9.5a8.625 8.625 0 0 1 17.25 0z"
      />
      <path
        fill={color}
        d="m14 20.875.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-4a1.125 1.125 0 0 1 0-2.25zm.454-13.17a1.125 1.125 0 0 1 1.59 1.59l-4.5 4.5c-.438.44-1.15.44-1.59 0l-2-2-.077-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078 1.204 1.204z"
      />
    </svg>
  );
}
