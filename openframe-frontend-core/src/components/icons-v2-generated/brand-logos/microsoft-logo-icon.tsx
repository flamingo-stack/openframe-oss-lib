import type { SVGProps } from "react";
export interface MicrosoftLogoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MicrosoftLogoIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MicrosoftLogoIconProps) {
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
      <path fill="#F1511B" d="M11.505 11.503H2V2h9.505z" />
      <path fill="#80CC28" d="M22 11.503h-9.505V2h9.504v9.503z" />
      <path fill="#00ADEF" d="M11.505 22H2v-9.503h9.505z" />
      <path fill="#FBBC09" d="M22 22h-9.505v-9.503h9.504V22z" />
    </svg>
  );
}
