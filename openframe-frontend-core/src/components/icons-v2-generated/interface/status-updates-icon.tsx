import type { SVGProps } from "react";
export interface StatusUpdatesIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StatusUpdatesIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: StatusUpdatesIconProps) {
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
        d="M59.003 43v4.263a6 6 0 0 0 1.699 4.184l.449.461c1.85 1.902.502 5.092-2.15 5.092H29.005c-2.653 0-4-3.19-2.15-5.092l.448-.461a6 6 0 0 0 1.7-4.184V40c0-8.284 6.715-15 15-15 .985 0 1.949.095 2.881.277M48 65h-8m24-35a5 5 0 1 1-10 0 5 5 0 0 1 10 0"
      />
    </svg>
  );
}
