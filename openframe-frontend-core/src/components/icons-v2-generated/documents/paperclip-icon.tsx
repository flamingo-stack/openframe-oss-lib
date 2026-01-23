import type { SVGProps } from "react";
export interface PaperclipIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PaperclipIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PaperclipIconProps) {
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
        d="M11.772 1.209a1.126 1.126 0 0 1 1.601 1.582L4.701 11.57c-2.102 2.128-2.102 5.585 0 7.714l.2.193a5.31 5.31 0 0 0 7.38-.193l7.652-7.746a3.296 3.296 0 0 0 0-4.616 3.166 3.166 0 0 0-4.52 0l-7.65 7.746a1.086 1.086 0 0 0 0 1.518 1.02 1.02 0 0 0 1.459 0l7.14-7.23.084-.079a1.125 1.125 0 0 1 1.516 1.66l-7.14 7.229a3.27 3.27 0 0 1-4.411.23l-.25-.23a3.334 3.334 0 0 1 0-4.679l7.65-7.746.204-.196a5.414 5.414 0 0 1 7.517.196 5.546 5.546 0 0 1 .194 7.572l-.194.207-7.65 7.746a7.56 7.56 0 0 1-10.496.274l-.284-.274c-2.968-3.005-2.968-7.872 0-10.877z"
      />
    </svg>
  );
}
