import type { SVGProps } from "react";
export interface Refresh02ExclamationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Refresh02ExclamationIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Refresh02ExclamationIconProps) {
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
        d="M1.875 19.5v-4a1.12 1.12 0 0 1 .32-.783l.033-.032a1.1 1.1 0 0 1 .347-.226q.037-.013.073-.023c.045-.015.09-.032.137-.041l.013-.001q.042-.008.086-.014L3 14.374h4l.115.006a1.126 1.126 0 0 1 0 2.239L7 16.625H5.643c1.776 1.842 3.413 3.25 6.359 3.25a7.88 7.88 0 0 0 7.428-5.25 1.125 1.125 0 0 1 2.12.75 10.13 10.13 0 0 1-9.549 6.75c-3.73 0-6.011-1.893-7.876-3.814V19.5a1.125 1.125 0 0 1-2.25 0M12 1.875c3.73 0 6.01 1.891 7.875 3.812V4.5a1.125 1.125 0 0 1 2.25 0v4c0 .622-.504 1.125-1.125 1.125h-4a1.126 1.126 0 0 1 0-2.25h1.36c-1.776-1.842-3.414-3.25-6.36-3.25a7.88 7.88 0 0 0-7.427 5.25 1.125 1.125 0 0 1-2.12-.75C3.841 4.695 7.59 1.875 12 1.875"
      />
      <path
        fill={color}
        d="M10.876 11.5v-3a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0m2.498 4a1.374 1.374 0 0 1-2.742.141l-.007-.14.007-.141a1.375 1.375 0 0 1 1.369-1.235l.14.007a1.376 1.376 0 0 1 1.233 1.369Z"
      />
    </svg>
  );
}
