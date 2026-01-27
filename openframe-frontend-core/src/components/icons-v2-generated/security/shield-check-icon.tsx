import type { SVGProps } from "react";
export interface ShieldCheckIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ShieldCheckIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ShieldCheckIconProps) {
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
        d="M18.856 7.188a1.88 1.88 0 0 0-1.03-1.42l-5-2.45a1.88 1.88 0 0 0-1.651 0l-5.001 2.45a1.88 1.88 0 0 0-1.049 1.685v6.013l.01.267c.1 1.332.935 2.675 2.178 3.93 1.302 1.315 2.891 2.37 3.983 3.016.44.26.969.26 1.408 0 1.092-.646 2.68-1.702 3.982-3.016 1.243-1.256 2.08-2.598 2.18-3.93l.01-.267V7.454l-.02-.265Zm2.27 6.279-.017.43c-.156 2.128-1.446 3.958-2.824 5.35-1.308 1.32-2.83 2.38-3.971 3.088l-.464.28a3.62 3.62 0 0 1-3.482.121l-.219-.12c-1.166-.69-2.939-1.86-4.434-3.37-1.378-1.39-2.668-3.221-2.824-5.349l-.016-.43V7.452c0-1.574.895-3.011 2.309-3.704l5-2.45.217-.1a4.13 4.13 0 0 1 3.415.1l5 2.45a4.13 4.13 0 0 1 2.31 3.704v6.013Z"
      />
      <path
        fill={color}
        d="M14.704 8.705a1.125 1.125 0 0 1 1.59 1.59l-4.5 4.5c-.439.44-1.15.44-1.59 0l-2-2-.077-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078L11 12.41z"
      />
    </svg>
  );
}
