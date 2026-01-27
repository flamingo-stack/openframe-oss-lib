import type { SVGProps } from "react";
export interface FileBookmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileBookmarkIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FileBookmarkIconProps) {
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
        d="M2.875 19V5A4.125 4.125 0 0 1 7 .875h6.586c.293 0 .58.063.844.177l.022.009q.258.115.48.296l.157.14 5.414 5.415c.18.18.322.39.426.618q.012.022.022.047c.113.262.174.547.174.838v.587a1.126 1.126 0 0 1-2.242.123H16A3.125 3.125 0 0 1 12.876 6V3.125H7c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h4.062l.116.005a1.125 1.125 0 0 1 0 2.239l-.116.006H7A4.125 4.125 0 0 1 2.875 19m12.25-13c0 .484.392.875.875.875h1.285l-2.16-2.16z"
      />
      <path
        fill={color}
        d="M20.875 14.5a.375.375 0 0 0-.375-.375h-4a.375.375 0 0 0-.375.375v5.605l1.627-1.446.17-.125a1.125 1.125 0 0 1 1.325.125l1.628 1.447zm2.25 6.998c0 1.313-1.456 2.05-2.502 1.37l-.203-.156-1.92-1.708-1.92 1.708c-1.049.93-2.704.187-2.705-1.214V14.5a2.625 2.625 0 0 1 2.625-2.625h4a2.625 2.625 0 0 1 2.625 2.625z"
      />
    </svg>
  );
}
