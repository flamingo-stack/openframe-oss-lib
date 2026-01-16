import type { SVGProps } from "react";
export interface Parcel02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Parcel02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Parcel02IconProps) {
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
        d="m19.875 8.912-6.75 3.748v7.361l5.774-3.155.214-.136c.475-.35.762-.909.762-1.51zM5.329 7.008 12 10.712 14.183 9.5 7.529 5.805zm7.57-3.154a1.88 1.88 0 0 0-1.583-.101l-.215.1-1.238.676 6.636 3.684 2.17-1.205zM4.125 15.22c0 .685.374 1.316.976 1.645l5.774 3.155v-7.36l-6.75-3.75zm18 0a4.13 4.13 0 0 1-2.146 3.62l-6 3.28a4.13 4.13 0 0 1-3.724.118l-.234-.119-6-3.28a4.13 4.13 0 0 1-2.146-3.62V8.78c0-.705.182-1.382.508-1.978a1.1 1.1 0 0 1 .17-.286A4.1 4.1 0 0 1 4.021 5.16l6-3.28.234-.119a4.13 4.13 0 0 1 3.724.12l6 3.279.242.143c.5.32.915.739 1.23 1.222a1.1 1.1 0 0 1 .166.277c.326.596.508 1.273.508 1.978v6.442Z"
      />
      <path
        fill={color}
        d="M5.017 13.453a1.125 1.125 0 0 1 1.425-.487l.104.05 3 1.666.099.062A1.126 1.126 0 0 1 8.558 16.7l-.104-.051-3-1.667-.099-.06a1.125 1.125 0 0 1-.338-1.47Z"
      />
    </svg>
  );
}
