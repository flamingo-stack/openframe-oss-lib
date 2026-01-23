import type { SVGProps } from "react";
export interface CheckFillIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CheckFillIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CheckFillIconProps) {
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
        fillRule="evenodd"
        d="M12.001.875c6.144 0 11.124 4.982 11.124 11.126s-4.98 11.124-11.124 11.124S.876 18.145.875 12.001 5.857.875 12.001.875m5.295 7.33a1.125 1.125 0 0 0-1.59 0L10.5 13.408l-2.204-2.205-.085-.077a1.126 1.126 0 0 0-1.584 1.583l.078.085 3 3c.44.44 1.152.44 1.59 0l6-6c.44-.44.44-1.152 0-1.59Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
