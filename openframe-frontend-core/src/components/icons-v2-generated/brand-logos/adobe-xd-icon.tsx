import type { SVGProps } from "react";
export interface AdobeXdIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AdobeXdIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AdobeXdIconProps) {
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
        d="M16.375 8a1.125 1.125 0 0 1 2.25 0v8c0 .62-.504 1.125-1.125 1.125-.279 0-.53-.105-.727-.273A3.124 3.124 0 0 1 12.376 14v-1a3.125 3.125 0 0 1 3.999-3zM7.48 16.552a1.126 1.126 0 0 1-1.96-1.103zm2.54-9.104a1.126 1.126 0 0 1 1.96 1.104L10.04 12l1.94 3.45a1.125 1.125 0 1 1-1.96 1.103l-1.27-2.259-1.27 2.259L6.5 16l-.98-.55L7.46 12 5.52 8.553l-.051-.104a1.124 1.124 0 0 1 1.95-1.097l.061.097 1.27 2.257 1.27-2.257ZM14.626 14a.874.874 0 0 0 1.73.176l.018-.176v-1l-.017-.176a.875.875 0 0 0-1.731.175z"
      />
    </svg>
  );
}
