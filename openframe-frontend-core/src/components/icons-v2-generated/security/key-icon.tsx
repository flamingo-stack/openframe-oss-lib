import type { SVGProps } from "react";
export interface KeyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function KeyIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: KeyIconProps) {
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
        d="M20.875 9.5a6.375 6.375 0 1 0-12.251 2.476c.178.421.082.91-.242 1.233l-5.257 5.257v2.409h1.75V20c0-.621.504-1.125 1.125-1.125h.875V18c0-.62.504-1.125 1.125-1.125h1.534l1.258-1.258.127-.11a1.13 1.13 0 0 1 1.105-.13 6.375 6.375 0 0 0 8.85-5.877Zm2.25 0a8.625 8.625 0 0 1-11.25 8.215l-1.08 1.08a1.12 1.12 0 0 1-.795.33h-.875V20c0 .621-.504 1.125-1.125 1.125h-.875V22c0 .62-.503 1.124-1.125 1.125H2.5A1.625 1.625 0 0 1 .875 21.5V18c0-.298.119-.584.33-.795l5.078-5.08A8.625 8.625 0 1 1 23.124 9.5Z"
      />
      <path
        fill={color}
        d="M16.875 8a.876.876 0 1 1-1.751-.002.876.876 0 0 1 1.751.002m2.25 0a3.126 3.126 0 1 0-6.25 0 3.126 3.126 0 0 0 6.25 0"
      />
    </svg>
  );
}
