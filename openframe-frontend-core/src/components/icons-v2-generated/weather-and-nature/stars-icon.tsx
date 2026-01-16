import type { SVGProps } from "react";
export interface StarsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StarsIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: StarsIconProps) {
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
        d="M2.875 22v-.875H2a1.125 1.125 0 0 1 0-2.25h.875V18a1.125 1.125 0 0 1 2.25 0v.875H6l.115.006a1.125 1.125 0 0 1 0 2.238L6 21.125h-.875V22a1.125 1.125 0 0 1-2.25 0m3-16v-.875H5a1.125 1.125 0 0 1 0-2.25h.875V2a1.125 1.125 0 0 1 2.25 0v.875H9l.115.005a1.126 1.126 0 0 1 0 2.239L9 5.125h-.875V6a1.125 1.125 0 0 1-2.25 0m7.766-.357c.601-1.024 2.116-1.024 2.717 0l.115.234 1.596 4.052 4.054 1.598c1.336.527 1.336 2.418 0 2.946l-4.054 1.596-1.596 4.054c-.527 1.336-2.419 1.336-2.946 0l-1.598-4.054-4.052-1.596c-1.336-.528-1.336-2.419 0-2.946l4.052-1.598 1.598-4.052zm.202 5.566c-.114.29-.344.52-.634.634L10.275 13l2.934 1.159.106.047c.24.124.428.332.528.585L15 17.724l1.159-2.932.047-.106a1.12 1.12 0 0 1 .586-.527L19.724 13l-2.932-1.156a1.13 1.13 0 0 1-.633-.634L15 8.276l-1.156 2.934Z"
      />
    </svg>
  );
}
