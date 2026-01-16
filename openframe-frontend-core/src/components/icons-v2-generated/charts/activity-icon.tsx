import type { SVGProps } from "react";
export interface ActivityIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ActivityIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ActivityIconProps) {
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
        d="M9 2.875c.469 0 .888.29 1.053.73L15 16.794l1.947-5.19.073-.158c.197-.35.57-.572.98-.572h3l.116.005a1.126 1.126 0 0 1 0 2.239l-.116.005h-2.22l-2.727 7.27a1.126 1.126 0 0 1-2.106 0L9 7.205l-1.947 5.191c-.164.44-.584.73-1.053.73H3a1.125 1.125 0 0 1 0-2.25h2.22l2.727-7.27.073-.157c.197-.35.57-.573.98-.573Z"
      />
    </svg>
  );
}
