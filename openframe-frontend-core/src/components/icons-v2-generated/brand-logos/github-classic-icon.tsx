import type { SVGProps } from "react";
export interface GithubClassicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GithubClassicIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: GithubClassicIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 15 14"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M7.182.333A6.833 6.833 0 0 0 .346 7.168a6.83 6.83 0 0 0 4.674 6.485c.342.06.47-.145.47-.324 0-.163-.009-.701-.009-1.274-1.717.317-2.161-.418-2.298-.803-.077-.196-.41-.803-.7-.965-.24-.128-.582-.444-.01-.453.54-.008.924.496 1.052.7.615 1.034 1.598.744 1.99.565.06-.445.24-.744.436-.915-1.52-.17-3.11-.76-3.11-3.375 0-.743.265-1.358.7-1.837-.067-.17-.307-.871.07-1.81 0 0 .572-.18 1.879.7a6.3 6.3 0 0 1 1.709-.231c.58 0 1.162.077 1.709.23 1.307-.888 1.88-.7 1.88-.7.375.94.136 1.64.068 1.811.435.479.7 1.086.7 1.837 0 2.623-1.597 3.205-3.118 3.375.247.214.461.624.461 1.265 0 .914-.008 1.649-.008 1.88 0 .179.128.393.47.324a6.85 6.85 0 0 0 4.656-6.485A6.833 6.833 0 0 0 7.182.333"
      />
    </svg>
  );
}
