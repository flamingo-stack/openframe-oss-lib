import type { SVGProps } from "react";
export interface Refresh02HrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Refresh02HrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Refresh02HrIconProps) {
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
        d="M1.875 19.5v-4c0-.251.085-.48.224-.667q.044-.061.095-.116l.034-.03a1.1 1.1 0 0 1 .347-.226c.024-.01.05-.015.073-.024.045-.014.09-.031.137-.04l.013-.002q.099-.019.202-.02h4l.115.005a1.126 1.126 0 0 1 0 2.239L7 16.625H5.643c1.776 1.842 3.413 3.25 6.359 3.25a7.88 7.88 0 0 0 7.428-5.25 1.125 1.125 0 0 1 2.12.75 10.13 10.13 0 0 1-9.549 6.75c-3.73 0-6.011-1.893-7.876-3.814V19.5a1.125 1.125 0 0 1-2.25 0M12 1.875c3.728 0 6.01 1.89 7.874 3.81V4.5a1.126 1.126 0 0 1 2.25 0v4c0 .622-.503 1.125-1.125 1.125H17a1.125 1.125 0 0 1 0-2.25h1.36c-1.776-1.842-3.414-3.25-6.36-3.25a7.88 7.88 0 0 0-7.427 5.25 1.125 1.125 0 0 1-2.121-.75c1.389-3.93 5.137-6.75 9.547-6.75Z"
      />
    </svg>
  );
}
