import type { SVGProps } from "react";
export interface GeminiLogoGreyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GeminiLogoGreyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GeminiLogoGreyIconProps) {
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
        d="M11.984 2c.209 0 .391.143.443.346q.234.933.614 1.817a12.8 12.8 0 0 0 2.725 4.039 12.8 12.8 0 0 0 4.038 2.724 12 12 0 0 0 1.818.615.457.457 0 0 1 0 .886q-.934.234-1.818.614a12.8 12.8 0 0 0-4.038 2.725 12.83 12.83 0 0 0-3.34 5.856.46.46 0 0 1-.442.345.46.46 0 0 1-.443-.346 12.809 12.809 0 0 0-3.34-5.855 12.8 12.8 0 0 0-5.855-3.34.457.457 0 0 1 0-.885 12.812 12.812 0 0 0 5.855-3.34 12.8 12.8 0 0 0 3.34-5.855.46.46 0 0 1 .443-.346"
      />
    </svg>
  );
}
