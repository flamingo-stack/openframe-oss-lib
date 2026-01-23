import type { SVGProps } from "react";
export interface EmailReadingIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EmailReadingIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EmailReadingIconProps) {
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
        d="M18.375 11.5V5c0-1.036-.84-1.875-1.875-1.875h-9c-1.036 0-1.875.84-1.875 1.875v6.5a1.125 1.125 0 0 1-2.25 0V5A4.125 4.125 0 0 1 7.5.875h9A4.125 4.125 0 0 1 20.625 5v6.5a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="m20.875 11.987-6.753 4.052a4.12 4.12 0 0 1-3.995.137l-.25-.137-6.752-4.052V19c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zM13.5 8.375l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.005h-5a1.125 1.125 0 0 1 0-2.25zm1.999-3.5.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-7a1.125 1.125 0 0 1 0-2.25zM23.125 19A4.125 4.125 0 0 1 19 23.125H5A4.125 4.125 0 0 1 .875 19v-7.234c0-1.549 1.584-2.542 2.949-1.96l.27.137 6.941 4.166a1.88 1.88 0 0 0 1.93 0l6.941-4.166.27-.137c1.365-.583 2.948.411 2.949 1.96z"
      />
    </svg>
  );
}
