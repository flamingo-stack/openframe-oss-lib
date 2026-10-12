import type { SVGProps } from "react";
export interface ShieldLockClassicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ShieldLockClassicIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: ShieldLockClassicIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 65 64"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        stroke={color}
        d="M27.667 30.667v-6a4.667 4.667 0 1 1 9.333 0v6M35.855 6.153l13.333 6.538a8 8 0 0 1 4.478 7.183v16.039c0 9.945-11.904 18.25-17.927 21.816a6.65 6.65 0 0 1-6.811 0C22.904 54.162 11 45.859 11 35.912V19.874a8 8 0 0 1 4.478-7.183l13.333-6.538a8 8 0 0 1 7.044 0ZM27 41.333h10.667a2.667 2.667 0 0 0 2.666-2.666v-5.334a2.667 2.667 0 0 0-2.666-2.666H27a2.667 2.667 0 0 0-2.667 2.666v5.334A2.667 2.667 0 0 0 27 41.333Z"
      />
    </svg>
  );
}
