import type { SVGProps } from "react";
export interface QuickbooksIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function QuickbooksIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: QuickbooksIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0m.642 4.134c.955 0 1.73.775 1.73 1.733v9.066h1.6a2.934 2.934 0 0 0 0-5.866h-.666V7.333h.665A4.663 4.663 0 0 1 20.63 12a4.66 4.66 0 0 1-4.658 4.667h-3.329zM7.984 7.333h3.329v12.533c-.956 0-1.73-.776-1.73-1.733V9.066h-1.6a2.934 2.934 0 0 0 0 5.867h.666v1.733h-.665A4.66 4.66 0 0 1 3.326 12a4.66 4.66 0 0 1 4.658-4.667" />
    </svg>
  );
}
