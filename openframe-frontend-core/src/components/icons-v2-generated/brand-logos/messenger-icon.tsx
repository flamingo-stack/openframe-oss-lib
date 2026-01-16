import type { SVGProps } from "react";
export interface MessengerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MessengerIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MessengerIconProps) {
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
        d="M4.133 4.133c4.344-4.345 11.39-4.345 15.734 0s4.344 11.39 0 15.734c-3.477 3.477-8.68 4.17-12.847 2.084l-3.17.762c-1.543.37-2.933-1.02-2.563-2.562l.76-3.173C-.037 12.812.657 7.609 4.133 4.133m14.143 1.592a8.875 8.875 0 0 0-12.55 0 8.88 8.88 0 0 0-1.5 10.562c.136.245.175.534.109.807l-.813 3.382 3.385-.811.207-.03c.207-.01.415.038.599.14a8.875 8.875 0 0 0 10.563-14.05"
      />
      <path
        fill={color}
        d="M16.136 9.28a1.125 1.125 0 0 1 1.729 1.44l-2.181 2.617a2.625 2.625 0 0 1-3.826.221l-.209-.221-1.028-1.233a.375.375 0 0 0-.514-.06l-.061.06-2.182 2.616-.077.085a1.126 1.126 0 0 1-1.651-1.525l2.181-2.618.207-.221a2.626 2.626 0 0 1 3.826.221l1.028 1.235.063.059a.375.375 0 0 0 .514-.059l2.181-2.618Z"
      />
    </svg>
  );
}
