import type { SVGProps } from "react";
export interface Office365LogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Office365LogoIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Office365LogoIconProps) {
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
        fill="#EB3C00"
        d="M4 18.133V5.975L15.014 2 21 3.87v16.367L15.014 22zl11.014 1.295V5.274L7.831 6.91v9.586z"
      />
    </svg>
  );
}
