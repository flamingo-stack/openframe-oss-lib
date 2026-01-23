import type { SVGProps } from "react";
export interface JarIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function JarIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: JarIconProps) {
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
        d="M17.875 17.125H6.125V19c0 1.035.84 1.875 1.875 1.875h8c1.035 0 1.875-.84 1.875-1.875zm-11.75-2.25h11.75v-1.75H6.125zm14 4.125a4.125 4.125 0 0 1-4.126 4.125H8A4.125 4.125 0 0 1 3.875 19v-9c0-.893.29-1.76.825-2.475l2.4-3.2a1.125 1.125 0 0 1 1.8 1.35l-2.4 3.2A1.88 1.88 0 0 0 6.125 10v.876h11.75V9.667a.88.88 0 0 0-.175-.526l-2.6-3.466-.064-.095a1.125 1.125 0 0 1 1.79-1.343l.074.088 2.6 3.467.144.208c.314.497.48 1.076.48 1.667z"
      />
      <path
        fill={color}
        d="M16 .875A3.125 3.125 0 0 1 19.125 4v1c0 .621-.504 1.125-1.125 1.125H6A1.125 1.125 0 0 1 4.875 5V4A3.125 3.125 0 0 1 8 .875zm-8 2.25a.87.87 0 0 0-.863.75h9.726a.87.87 0 0 0-.863-.75z"
      />
    </svg>
  );
}
