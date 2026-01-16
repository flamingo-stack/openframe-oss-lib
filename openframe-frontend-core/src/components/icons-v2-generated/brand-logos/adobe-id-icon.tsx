import type { SVGProps } from "react";
export interface AdobeIdIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AdobeIdIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AdobeIdIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="m10.5 6.875.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-.876v5.75h.876l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006H6.5a1.125 1.125 0 0 1 0-2.25h.875v-5.75H6.5a1.125 1.125 0 0 1 0-2.25zM16.376 8a1.125 1.125 0 0 1 2.25 0v8c0 .62-.504 1.125-1.125 1.125-.279 0-.53-.105-.727-.273A3.124 3.124 0 0 1 12.376 14v-1a3.125 3.125 0 0 1 3.999-3V8Zm-1.75 6a.874.874 0 0 0 1.732.176l.018-.176v-1l-.018-.176a.875.875 0 0 0-1.731.175V14Z"
      />
    </svg>
  );
}
