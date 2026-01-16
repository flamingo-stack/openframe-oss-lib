import type { SVGProps } from "react";
export interface Number4IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Number4Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Number4IconProps) {
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
        d="M13.376 20v-2.375H7c-1.268 0-2.048-1.387-1.389-2.47l7.002-11.499.084-.126c.903-1.237 2.928-.62 2.928.972v10.873H17.5l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-1.875V20a1.125 1.125 0 0 1-2.25 0Zm-5.263-4.625h5.263V6.73z"
      />
    </svg>
  );
}
