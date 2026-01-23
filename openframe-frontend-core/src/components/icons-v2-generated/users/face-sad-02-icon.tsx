import type { SVGProps } from "react";
export interface FaceSad02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FaceSad02Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FaceSad02IconProps) {
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
        d="M12 13.876c1.879 0 3.56.847 4.683 2.177l.216.27.065.097a1.126 1.126 0 0 1-1.79 1.344l-.073-.088-.138-.173A3.87 3.87 0 0 0 12 16.126a3.87 3.87 0 0 0-3.1 1.55l-.075.088a1.125 1.125 0 0 1-1.724-1.44l.217-.271a6.11 6.11 0 0 1 4.681-2.177ZM9.124 8.288a1.126 1.126 0 0 1 1.75 1.417c-1.186 1.463-3.21 1.554-4.5.274l-.25-.274-.067-.093a1.126 1.126 0 0 1 1.739-1.41l.078.086.143.147c.35.295.789.246 1.107-.147m7.079-.085a1.125 1.125 0 0 1 1.67 1.502l-.248.274c-1.29 1.28-3.314 1.189-4.5-.274l1.748-1.417c.364.449.888.449 1.252 0zm-2.913-.081a1.125 1.125 0 0 1 1.582.166l-1.747 1.417a1.126 1.126 0 0 1 .165-1.583"
      />
    </svg>
  );
}
