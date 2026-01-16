import type { SVGProps } from "react";
export interface FileMusicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileMusicIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FileMusicIconProps) {
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
        d="M2.875 19V5A4.125 4.125 0 0 1 7 .875h6.586c.293 0 .58.063.844.177l.022.009q.258.115.48.296l.157.14 5.414 5.415c.18.18.322.39.426.618q.012.022.022.047c.113.262.174.547.174.838V19A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19m12.25-13c0 .484.392.875.875.875h1.285l-2.16-2.16zm-10 13c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875V9.125H16A3.125 3.125 0 0 1 12.876 6V3.125H7c-1.036 0-1.875.84-1.875 1.875z"
      />
      <path
        fill={color}
        d="M14.892 10.376a2.125 2.125 0 0 1 2.233 2.122v4.4l-.003.048.003.054a2.125 2.125 0 0 1-4.24.217l-.01-.217.01-.217a2.125 2.125 0 0 1 1.99-1.903v-2.235l-3.75.625V18l-.01.217a2.125 2.125 0 0 1-4.23 0L6.875 18l.01-.218a2.124 2.124 0 0 1 1.99-1.901v-2.716c0-1.039.752-1.926 1.776-2.096l4-.667z"
      />
    </svg>
  );
}
