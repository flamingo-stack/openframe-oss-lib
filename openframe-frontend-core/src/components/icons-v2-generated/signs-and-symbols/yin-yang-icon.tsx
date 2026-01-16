import type { SVGProps } from "react";
export interface YinYangIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function YinYangIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: YinYangIconProps) {
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
        d="M15.876 17c0-1.903-1.316-3.33-3.573-3.804l-.465-.082C8.572 12.639 5.875 10.493 5.875 7A6.125 6.125 0 0 1 11.999.875a1.125 1.125 0 0 1 0 2.25A3.875 3.875 0 0 0 8.125 7c0 2.03 1.496 3.518 4.037 3.887l.605.109c2.988.639 5.358 2.73 5.358 6.004A6.125 6.125 0 0 1 12 23.125a1.125 1.125 0 0 1 0-2.25A3.875 3.875 0 0 0 15.877 17Zm-3.736-1.368a1.375 1.375 0 1 1-1.507 1.509L10.626 17l.007-.14A1.375 1.375 0 0 1 12 15.623l.14.008Zm0-10a1.374 1.374 0 1 1-1.507 1.508L10.626 7l.007-.141A1.374 1.374 0 0 1 12 5.625l.14.008Z"
      />
      <path
        fill={color}
        d="M20.875 12a8.876 8.876 0 1 0-17.752.001 8.876 8.876 0 0 0 17.752 0Zm2.25 0c0 6.144-4.982 11.124-11.126 11.125S.875 18.145.875 12 5.855.875 11.999.875s11.126 4.981 11.126 11.126Z"
      />
    </svg>
  );
}
