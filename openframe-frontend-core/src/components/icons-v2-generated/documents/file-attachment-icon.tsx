import type { SVGProps } from "react";
export interface FileAttachmentIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FileAttachmentIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FileAttachmentIconProps) {
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
        d="M2.875 19V5A4.125 4.125 0 0 1 7 .875h6.586c.293 0 .58.063.844.177l.022.009q.258.115.48.296l.157.14 5.414 5.415c.18.18.322.39.426.618q.012.022.022.047c.113.262.174.547.174.838V10a1.125 1.125 0 0 1-2.25 0v-.875H16A3.125 3.125 0 0 1 12.876 6V3.125H7c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h5.676l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006H7A4.125 4.125 0 0 1 2.875 19m12.25-13c0 .484.392.875.875.875h1.285l-2.16-2.16z"
      />
      <path
        fill={color}
        d="M14.875 19v-2.5a1.125 1.125 0 0 1 2.25 0V19a1.875 1.875 0 0 0 3.74.191l.01-.191v-3.5a.375.375 0 0 0-.75 0V19a1.125 1.125 0 0 1-2.25 0v-3.5a2.625 2.625 0 0 1 5.25 0V19l-.022.421A4.124 4.124 0 0 1 14.875 19"
      />
    </svg>
  );
}
