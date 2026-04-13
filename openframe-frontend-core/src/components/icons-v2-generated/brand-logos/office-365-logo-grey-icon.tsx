import type { SVGProps } from "react";
export interface Office365LogoGreyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Office365LogoGreyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Office365LogoGreyIconProps) {
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
        d="M4 18.133V5.975L15.014 2 21 3.87v16.368L15.014 22zl11.014 1.295V5.274L7.831 6.91v9.586z"
      />
    </svg>
  );
}
