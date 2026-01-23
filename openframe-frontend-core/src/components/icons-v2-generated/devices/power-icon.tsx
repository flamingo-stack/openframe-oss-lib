import type { SVGProps } from "react";
export interface PowerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PowerIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PowerIconProps) {
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
        d="M10.875 12V2a1.125 1.125 0 0 1 2.25 0v10a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M17.565 5.845a1.126 1.126 0 0 1 1.505-.078l.085.078.261.27a10.125 10.125 0 1 1-14.58-.27 1.125 1.125 0 0 1 1.59 1.59A7.877 7.877 0 0 0 7.62 19.551a7.877 7.877 0 0 0 11.651-3.534 7.88 7.88 0 0 0-1.31-8.155l-.396-.427-.078-.085a1.126 1.126 0 0 1 .078-1.505"
      />
    </svg>
  );
}
