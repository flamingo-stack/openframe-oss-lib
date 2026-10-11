import type { SVGProps } from "react";
export interface BulkOperationsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BulkOperationsIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BulkOperationsIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 90 90"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        stroke="var(--ods-open-yellow-base)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M63 32H45m18 12H45m18 12H45M27 43l3 3 6-6m-9 15 3 3 6-6m-9-21 3 3 6-6"
      />
    </svg>
  );
}
