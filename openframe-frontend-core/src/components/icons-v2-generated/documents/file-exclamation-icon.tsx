import type { SVGProps } from "react";
export interface FileExclamationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileExclamationIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FileExclamationIconProps) {
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
        d="M10.876 14.5v-3a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0m2.498 4a1.374 1.374 0 0 1-2.742.141l-.007-.14.007-.141a1.375 1.375 0 0 1 1.369-1.235l.14.007a1.375 1.375 0 0 1 1.233 1.368"
      />
    </svg>
  );
}
