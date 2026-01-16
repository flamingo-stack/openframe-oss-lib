import type { SVGProps } from "react";
export interface TacticalRmmLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TacticalRmmLogoIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TacticalRmmLogoIconProps) {
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
        d="m10.918 2-.896 1.7 2.526.648zM4.97 8.397 0 13.093l4.4 3.077 4.237-2.105L22 22l-11.082-9.393v-1.943z"
      />
      <path
        fill={color}
        d="M5.948 15.441v1.539h7.66zm12.385 1.053-2.851-2.348h3.422l-.57 2.348ZM10.022 3.7C5.584 4.812 3.411 5.603 0 7.263v2.105l4.726-1.052 11.163 2.024 2.526-1.7-1.874-1.377-.326-1.943z"
      />
    </svg>
  );
}
