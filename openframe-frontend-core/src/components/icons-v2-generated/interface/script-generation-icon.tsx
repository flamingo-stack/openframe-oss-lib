import type { SVGProps } from "react";
export interface ScriptGenerationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ScriptGenerationIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ScriptGenerationIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 90 90"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        stroke="var(--ods-open-yellow-base)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M27 39h36m-8 16h-8m-12-9 4.5 4.5L35 55m22 8H33a6 6 0 0 1-6-6V33a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6"
      />
    </svg>
  );
}
