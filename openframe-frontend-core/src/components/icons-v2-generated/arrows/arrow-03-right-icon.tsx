import type { SVGProps } from "react";
export interface Arrow03RightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Arrow03RightIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Arrow03RightIconProps) {
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
        d="M19.875 17V7a1.125 1.125 0 0 1 2.25 0v10a1.125 1.125 0 0 1-2.25 0m-12.671.795a1.125 1.125 0 0 0 1.59-1.59l-3.078-3.08H16l.115-.005a1.126 1.126 0 0 0 0-2.239L16 10.876H5.715l3.079-3.081.078-.085A1.126 1.126 0 0 0 7.29 6.128l-.087.076-5 5.001a1.125 1.125 0 0 0 0 1.59z"
      />
    </svg>
  );
}
