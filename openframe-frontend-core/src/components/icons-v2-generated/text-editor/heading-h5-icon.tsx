import type { SVGProps } from "react";
export interface HeadingH5IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HeadingH5Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HeadingH5IconProps) {
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
        d="M17.151 17.375a1.126 1.126 0 0 1 1.377.613l.041.109.065.146c.188.339.626.632 1.116.632.629 0 1.125-.497 1.125-1.125v-.5c0-.61-.505-1.125-1.125-1.125-.662 0-1.103.309-1.748.631a1.125 1.125 0 0 1-1.624-1.08l.233-3.518v-.006l.016-.133c.11-.654.68-1.144 1.356-1.144H21.5l.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-2.699l-.06.877a4.2 4.2 0 0 1 1.008-.127c1.88 0 3.375 1.54 3.375 3.375v.5a3.366 3.366 0 0 1-3.375 3.375c-1.35 0-2.684-.813-3.223-2.075l-.096-.258-.031-.11a1.126 1.126 0 0 1 .751-1.307M11.874 20v-6.876H3.125V20a1.125 1.125 0 0 1-2.25 0V4a1.125 1.125 0 0 1 2.25 0v6.874h8.75V4a1.125 1.125 0 0 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
