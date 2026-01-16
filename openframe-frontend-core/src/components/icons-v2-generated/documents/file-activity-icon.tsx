import type { SVGProps } from "react";
export interface FileActivityIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileActivityIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FileActivityIconProps) {
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
        d="M10.5 10.375c.45 0 .857.268 1.034.681l1.966 4.587.466-1.086.078-.148c.202-.328.562-.535.956-.535h1.5l.116.006a1.126 1.126 0 0 1 0 2.239l-.116.006h-.757l-1.209 2.818a1.126 1.126 0 0 1-2.068 0L10.5 14.356l-.466 1.087A1.13 1.13 0 0 1 9 16.125H7.5a1.125 1.125 0 0 1 0-2.25h.759l1.207-2.819.077-.148c.203-.328.564-.533.957-.533"
      />
    </svg>
  );
}
