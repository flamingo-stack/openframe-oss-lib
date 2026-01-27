import type { SVGProps } from "react";
export interface ForwardIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ForwardIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ForwardIconProps) {
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
        d="m11.5 13.61.641.925-7.44 5.154C3.085 20.81.875 19.652.875 17.685V6.315c0-1.966 2.21-3.124 3.826-2.004l7.44 5.154a1.126 1.126 0 0 1-1.282 1.85L3.42 6.16a.188.188 0 0 0-.294.155v11.37c0 .152.17.24.294.154l7.44-5.154zm-.64-.925a1.126 1.126 0 0 1 1.281 1.85z"
      />
      <path
        fill={color}
        d="M10.375 6.315c0-1.966 2.21-3.124 3.826-2.004l7.686 5.325c1.6 1.108 1.649 3.432.15 4.616l-.15.111-7.686 5.326c-1.616 1.12-3.826-.037-3.826-2.004zm2.25 11.37c0 .152.17.24.294.154l7.686-5.324a.626.626 0 0 0 0-1.029L12.92 6.16a.188.188 0 0 0-.294.155z"
      />
    </svg>
  );
}
