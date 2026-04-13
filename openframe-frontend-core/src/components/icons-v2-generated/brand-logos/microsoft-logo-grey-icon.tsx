import type { SVGProps } from "react";
export interface MicrosoftLogoGreyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MicrosoftLogoGreyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MicrosoftLogoGreyIconProps) {
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
        d="M11.505 11.503H2V2h9.505zM22 11.503h-9.505V2h9.504zM11.505 22H2v-9.503h9.505zM22 22h-9.505v-9.503h9.504z"
      />
    </svg>
  );
}
