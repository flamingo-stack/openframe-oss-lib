import type { SVGProps } from "react";
export interface Numer2CircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Numer2CircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Numer2CircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M13.125 10.3v-.05c0-.61-.505-1.125-1.125-1.125-.56 0-1.052.384-1.18.78a1.125 1.125 0 0 1-2.14-.698C9.14 7.8 10.56 6.875 12 6.875c1.88 0 3.375 1.54 3.375 3.375v.05c0 1.051-.463 1.818-1.084 2.365-.564.498-1.28.83-1.815 1.08-.607.283-1.02.478-1.308.715-.18.147-.256.266-.281.414h3.363l.116.006a1.126 1.126 0 0 1 0 2.239l-.116.006H10a1.375 1.375 0 0 1-1.375-1.374V15c0-1.038.497-1.773 1.113-2.28.556-.457 1.268-.773 1.786-1.015.59-.275.999-.481 1.279-.728.223-.197.322-.38.322-.678Z"
      />
    </svg>
  );
}
