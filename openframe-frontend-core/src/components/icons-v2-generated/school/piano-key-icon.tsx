import type { SVGProps } from "react";
export interface PianoKeyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PianoKeyIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PianoKeyIconProps) {
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
        d="M6.875 14a1.125 1.125 0 0 1 2.25 0v5.875h5.75V14a1.125 1.125 0 0 1 2.25 0v5.874H19c1.035 0 1.875-.84 1.875-1.875V7c0-1.036-.84-1.875-1.875-1.875h-1a1.125 1.125 0 0 1 0-2.25h1A4.125 4.125 0 0 1 23.125 7v11A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18V7A4.125 4.125 0 0 1 5 2.875h1l.115.006a1.126 1.126 0 0 1 0 2.238L6 5.125H5c-1.036 0-1.875.84-1.875 1.875v11c0 1.035.84 1.875 1.875 1.875h1.875zM14 2.876l.116.006a1.125 1.125 0 0 1 0 2.238L14 5.125h-4a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M15.124 12.874h1.751V4.125h-1.75zm-7.999 0h1.75V4.125h-1.75zm4 .127A2.125 2.125 0 0 1 9 15.123H7A2.125 2.125 0 0 1 4.875 13V4c0-1.174.952-2.126 2.125-2.126h2c1.174 0 2.126.952 2.126 2.125v9Zm8 0A2.125 2.125 0 0 1 17 15.123h-2A2.125 2.125 0 0 1 12.874 13V4c0-1.174.952-2.126 2.126-2.126h2c1.173 0 2.125.952 2.125 2.125v9Z"
      />
    </svg>
  );
}
