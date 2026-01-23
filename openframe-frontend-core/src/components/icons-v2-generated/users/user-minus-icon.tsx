import type { SVGProps } from "react";
export interface UserMinusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UserMinusIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: UserMinusIconProps) {
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
        d="M22 19.875a1.125 1.125 0 0 1 0 2.25h-6a1.125 1.125 0 0 1 0-2.25zm-9.143-6a6.26 6.26 0 0 1 4.744 2.17l.222.273.066.096a1.125 1.125 0 0 1-1.772 1.366l-.075-.088-.144-.175a4 4 0 0 0-3.04-1.392H7.142a4.014 4.014 0 0 0-4.005 3.75H12l.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006H2.857a1.98 1.98 0 0 1-1.982-1.982 6.27 6.27 0 0 1 6.268-6.268zm.269-6.625a3.126 3.126 0 1 0-6.252.002 3.126 3.126 0 0 0 6.252-.002m2.25 0a5.376 5.376 0 1 1-10.75 0 5.376 5.376 0 0 1 10.75 0"
      />
    </svg>
  );
}
