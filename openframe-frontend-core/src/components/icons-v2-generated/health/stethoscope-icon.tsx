import type { SVGProps } from "react";
export interface StethoscopeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StethoscopeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: StethoscopeIconProps) {
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
        d="M6.875 16v-1.5a1.125 1.125 0 0 1 2.25 0V16a4.875 4.875 0 0 0 9.75 0v-2.5a1.125 1.125 0 1 1 2.25 0V16a7.125 7.125 0 0 1-14.25 0"
      />
      <path
        fill={color}
        d="M11.164 1.497a1.125 1.125 0 0 1 1.509-.503l.728.363.217.12a3.13 3.13 0 0 1 1.505 2.833l-.021.246-.712 5.458a6.444 6.444 0 0 1-12.78 0L.898 4.556a3.125 3.125 0 0 1 1.701-3.2l.728-.362a1.125 1.125 0 0 1 1.006 2.012l-.728.364a.88.88 0 0 0-.476.896l.712 5.458a4.194 4.194 0 0 0 8.318 0l.712-5.458.007-.138a.88.88 0 0 0-.483-.758l-.729-.364a1.125 1.125 0 0 1-.502-1.509m9.71 10.002a.875.875 0 1 0-1.749 0 .875.875 0 0 0 1.75 0Zm2.25 0a3.125 3.125 0 1 1-6.25.001 3.125 3.125 0 0 1 6.25 0Z"
      />
    </svg>
  );
}
