import type { SVGProps } from "react";
export interface FileCodeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileCodeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FileCodeIconProps) {
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
        d="M9.205 11.955a1.125 1.125 0 1 1 1.59 1.59L9.341 15l1.454 1.455.078.085a1.125 1.125 0 0 1-1.583 1.583l-.085-.078-2.25-2.25a1.125 1.125 0 0 1 0-1.59zm4 0a1.125 1.125 0 0 1 1.505-.078l.086.078 2.25 2.25a1.126 1.126 0 0 1 0 1.59l-2.25 2.25a1.125 1.125 0 0 1-1.59-1.59L14.66 15l-1.455-1.455-.078-.085a1.125 1.125 0 0 1 .078-1.505"
      />
    </svg>
  );
}
