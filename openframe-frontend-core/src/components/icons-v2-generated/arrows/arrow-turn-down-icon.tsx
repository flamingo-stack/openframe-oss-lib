import type { SVGProps } from "react";
export interface ArrowTurnDownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowTurnDownIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ArrowTurnDownIconProps) {
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
        d="M12.876 21V10A4.875 4.875 0 0 0 8 5.125H4a1.125 1.125 0 0 1 0-2.25h4A7.125 7.125 0 0 1 15.126 10v11a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19.205 14.205a1.125 1.125 0 1 1 1.59 1.59l-6 6c-.439.44-1.151.44-1.59 0l-6-6-.078-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078L14 19.409z"
      />
    </svg>
  );
}
