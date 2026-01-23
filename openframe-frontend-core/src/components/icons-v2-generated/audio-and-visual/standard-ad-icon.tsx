import type { SVGProps } from "react";
export interface StandardAdIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StandardAdIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: StandardAdIconProps) {
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
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
      <path
        fill={color}
        d="M6.225 8.14c.558-1.687 2.99-1.687 3.55 0l.05.175 1.769 7.424.022.113a1.125 1.125 0 0 1-2.178.52l-.033-.112-.39-1.635h-2.03l-.39 1.635a1.125 1.125 0 0 1-2.188-.521l1.77-7.424.05-.174Zm11.15 2.36c0-.759-.616-1.375-1.375-1.375h-.874v5.75H16c.76 0 1.375-.615 1.375-1.374zm-9.854 1.876h.958L8 10.367l-.478 2.008ZM19.625 13.5A3.625 3.625 0 0 1 16 17.125h-1.75a1.374 1.374 0 0 1-1.374-1.374v-7.5c0-.76.614-1.376 1.373-1.376H16a3.626 3.626 0 0 1 3.625 3.626z"
      />
    </svg>
  );
}
