import type { SVGProps } from "react";
export interface ApronIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ApronIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ApronIconProps) {
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
        d="M4.375 19V9.959a1.125 1.125 0 0 1 2.25 0v9.04c0 1.036.84 1.876 1.875 1.876h7c1.036 0 1.875-.84 1.875-1.875V9.959a1.125 1.125 0 0 1 2.25 0v9.04a4.125 4.125 0 0 1-4.124 4.126H8.5A4.125 4.125 0 0 1 4.375 19"
      />
      <path
        fill={color}
        d="M13.374 15.125h-2.749v.375a1.376 1.376 0 0 0 2.75 0zM14.874 6a2.875 2.875 0 1 0-5.749 0v.875h5.75zm.75 9.5a3.625 3.625 0 1 1-7.249 0v-1c0-.898.727-1.625 1.625-1.625h4c.897 0 1.624.727 1.624 1.624zm1.5-8.5c0 .22.039.431.107.625l.118.264c.317.588.938.985 1.65.986a4.125 4.125 0 0 1 4.126 4.124v2.002a1.125 1.125 0 0 1-2.25 0v-2.002c0-1.035-.84-1.875-1.875-1.875a4.12 4.12 0 0 1-3.532-1.999H8.532a4.12 4.12 0 0 1-3.532 2c-1.035 0-1.875.84-1.875 1.874v2.002a1.125 1.125 0 0 1-2.25 0v-2.002A4.125 4.125 0 0 1 5 8.875c.815 0 1.51-.52 1.768-1.25l.045-.148q.061-.227.062-.477V6a5.126 5.126 0 0 1 10.25 0v1Z"
      />
    </svg>
  );
}
