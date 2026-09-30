import type { SVGProps } from "react";
export interface OpenframeLogoGreyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function OpenframeLogoGreyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: OpenframeLogoGreyIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 120 120"
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M80 62a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H82a2 2 0 0 1-2-2zM60 82a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H62a2 2 0 0 1-2-2zM100 82a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2zM80 102a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H82a2 2 0 0 1-2-2z"
      />
      <path
        fill={color}
        d="M116 0H4a4 4 0 0 0-4 4v112a4 4 0 0 0 4 4h52a4 4 0 0 0 4-4v-12a4 4 0 0 0-4-4H22a2 2 0 0 1-2-2V22a2 2 0 0 1 2-2h76a2 2 0 0 1 2 2v34a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4V4a4 4 0 0 0-4-4"
      />
    </svg>
  );
}
