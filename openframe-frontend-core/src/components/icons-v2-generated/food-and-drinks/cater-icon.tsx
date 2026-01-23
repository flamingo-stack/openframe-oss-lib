import type { SVGProps } from "react";
export interface CaterIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CaterIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CaterIconProps) {
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
        d="m22 17.375.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-.151l-.352 1.233a3.124 3.124 0 0 1-3.004 2.267H5.507a3.12 3.12 0 0 1-2.923-2.02l-.082-.247-.351-1.233H2a1.125 1.125 0 0 1 0-2.25zM4.666 20.24l.051.135c.143.302.448.5.79.5h12.986c.39 0 .733-.259.84-.635l.176-.615H4.49zm7.732-13.355c1.95.107 3.694 1 4.916 2.365a1.126 1.126 0 0 1-1.678 1.5 4.86 4.86 0 0 0-3.363-1.618l-.268-.007-.116-.006a1.125 1.125 0 0 1 .116-2.244z"
      />
      <path
        fill={color}
        d="M20.375 15v-1.1a8.273 8.273 0 0 0-8.27-8.275h-.201a8.273 8.273 0 0 0-8.27 8.275V15a1.125 1.125 0 0 1-2.25 0v-1.1c0-4.941 3.404-9.087 7.996-10.218V3.5a2.625 2.625 0 0 1 5.248 0v.182c4.592 1.131 7.997 5.277 7.997 10.218V15a1.125 1.125 0 0 1-2.25 0m-8.37-11.875a.38.38 0 0 0-.356.256q.127-.004.255-.006h.2q.128.002.254.006a.37.37 0 0 0-.353-.256"
      />
    </svg>
  );
}
