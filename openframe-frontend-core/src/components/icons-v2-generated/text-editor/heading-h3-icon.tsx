import type { SVGProps } from "react";
export interface HeadingH3IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HeadingH3Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HeadingH3IconProps) {
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
        d="M17.151 17.375a1.126 1.126 0 0 1 1.377.613l.041.109.065.146c.188.339.626.632 1.116.632a1.125 1.125 0 0 0 0-2.25h-.05a1.125 1.125 0 0 1 0-2.25h.1a.625.625 0 1 0 0-1.25h-.1a.63.63 0 0 0-.565.357l-.054.102a1.125 1.125 0 0 1-1.98-1.067l.094-.177a2.87 2.87 0 0 1 2.505-1.465h.1a2.876 2.876 0 0 1 2.36 4.515 3.375 3.375 0 0 1-2.41 5.735c-1.35 0-2.684-.813-3.223-2.075l-.096-.258-.031-.11a1.126 1.126 0 0 1 .751-1.307M11.874 20v-6.876H3.125V20a1.125 1.125 0 0 1-2.25 0V4a1.125 1.125 0 0 1 2.25 0v6.874h8.75V4a1.125 1.125 0 0 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
