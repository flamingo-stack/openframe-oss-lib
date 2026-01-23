import type { SVGProps } from "react";
export interface HeadingH2IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HeadingH2Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HeadingH2IconProps) {
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
        d="M20.875 14.3v-.05c0-.61-.505-1.125-1.125-1.125-.56 0-1.052.384-1.18.78a1.125 1.125 0 0 1-2.14-.698c.459-1.407 1.88-2.332 3.32-2.332 1.88 0 3.375 1.54 3.375 3.375v.05c0 1.051-.463 1.818-1.084 2.366-.564.497-1.28.83-1.815 1.08-.607.282-1.02.477-1.308.714-.18.147-.256.266-.281.415H22l.116.005a1.126 1.126 0 0 1 0 2.239l-.116.006h-4.25a1.375 1.375 0 0 1-1.375-1.375V19c0-1.037.497-1.772 1.113-2.279.556-.457 1.268-.773 1.786-1.015.59-.275.999-.481 1.279-.728.223-.197.322-.38.322-.678M11.874 20v-6.876H3.125V20a1.125 1.125 0 0 1-2.25 0V4a1.125 1.125 0 0 1 2.25 0v6.874h8.75V4a1.125 1.125 0 0 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
