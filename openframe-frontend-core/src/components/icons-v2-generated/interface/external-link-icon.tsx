import type { SVGProps } from "react";
export interface ExternalLinkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ExternalLinkIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ExternalLinkIconProps) {
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
        d="M1.875 18V6A4.125 4.125 0 0 1 6 1.875h3a1.125 1.125 0 0 1 0 2.25H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875v-3a1.125 1.125 0 0 1 2.25 0v3A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18"
      />
      <path
        fill={color}
        d="m22.125 8.499-.005.115a1.126 1.126 0 0 1-2.239.002l-.006-.116-.002-2.789-8.078 8.085a1.125 1.125 0 0 1-1.59-1.591l8.077-8.083H15.5a1.125 1.125 0 0 1 0-2.25h5.498c.62 0 1.124.504 1.125 1.125z"
      />
    </svg>
  );
}
