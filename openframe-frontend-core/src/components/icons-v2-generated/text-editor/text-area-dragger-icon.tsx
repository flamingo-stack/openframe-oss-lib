import type { SVGProps } from "react";
export interface TextAreaDraggerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TextAreaDraggerIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TextAreaDraggerIconProps) {
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
        d="M19.47 17.47a.75.75 0 1 1 1.06 1.06l-2 2a.75.75 0 1 1-1.06-1.06zm0-4a.75.75 0 1 1 1.06 1.06l-6 6a.75.75 0 1 1-1.06-1.06zm0-4a.75.75 0 1 1 1.06 1.06l-10 10a.75.75 0 1 1-1.06-1.06z"
      />
    </svg>
  );
}
