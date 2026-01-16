import type { SVGProps } from "react";
export interface InfoIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function InfoIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: InfoIconProps) {
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
        d="M12.01 7.875c.621 0 1.125.504 1.125 1.125v9.875H14l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006h-4a1.125 1.125 0 0 1 0-2.25h.885v-8.75H10a1.125 1.125 0 0 1 0-2.25zm-.51-3.746a.62.62 0 0 0-.124.37l.011.126c.019.091.06.173.113.245v-.74Zm1 .741a.6.6 0 0 0 .112-.245l.013-.125-.013-.126a.6.6 0 0 0-.111-.245zm1.126-.37a1.625 1.625 0 0 1-3.242.167l-.009-.167.009-.166a1.625 1.625 0 0 1 1.615-1.459l.167.009c.82.083 1.46.775 1.46 1.616"
      />
    </svg>
  );
}
