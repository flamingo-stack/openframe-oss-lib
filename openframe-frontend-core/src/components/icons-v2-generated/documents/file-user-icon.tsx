import type { SVGProps } from "react";
export interface FileUserIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileUserIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FileUserIconProps) {
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
        d="M14.124 19c0-.76-.614-1.375-1.373-1.375h-1.5c-.76 0-1.376.616-1.376 1.375a1.125 1.125 0 0 1-2.25 0 3.626 3.626 0 0 1 3.626-3.626h1.5A3.625 3.625 0 0 1 16.375 19a1.125 1.125 0 0 1-2.25 0Zm-1.373-7.125a.75.75 0 1 0-1.501 0 .75.75 0 0 0 1.5 0Zm2.25 0a3 3 0 1 1-6.001 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  );
}
