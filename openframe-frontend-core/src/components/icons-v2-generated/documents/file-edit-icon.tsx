import type { SVGProps } from "react";
export interface FileEditIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileEditIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FileEditIconProps) {
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
        d="M2.875 19V5A4.125 4.125 0 0 1 7 .875h6.586c.293 0 .58.063.844.177l.022.009q.258.115.48.296l.157.14 5.414 5.415c.18.18.322.39.426.618q.012.022.022.047c.113.262.174.547.174.838V9a1.126 1.126 0 0 1-2.242.125H16A3.125 3.125 0 0 1 12.876 6V3.125H7c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h2l.115.005a1.125 1.125 0 0 1 0 2.239L9 23.125H7A4.125 4.125 0 0 1 2.875 19m12.25-13c0 .484.392.875.875.875h1.285l-2.16-2.16z"
      />
      <path
        fill={color}
        d="M18.089 12.645a2.624 2.624 0 0 1 3.712 0l.554.554.18.2a2.625 2.625 0 0 1-.18 3.512l-1.336 1.334-.01.014-.014.01-3.39 3.391a4.1 4.1 0 0 1-1.924 1.087l-.314.066-1.778.296a1.475 1.475 0 0 1-1.698-1.698l.296-1.778a4.13 4.13 0 0 1 1.153-2.239zm-3.158 6.34c-.277.277-.46.633-.525 1.018l-.118.708.709-.117.143-.03a1.9 1.9 0 0 0 .875-.495l2.606-2.607-1.084-1.084zm5.279-4.749a.375.375 0 0 0-.53 0l-.551.551 1.084 1.084.55-.55.049-.06a.38.38 0 0 0 0-.412l-.048-.06z"
      />
    </svg>
  );
}
