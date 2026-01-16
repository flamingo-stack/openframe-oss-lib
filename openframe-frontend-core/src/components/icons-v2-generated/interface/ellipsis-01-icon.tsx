import type { SVGProps } from "react";
export interface Ellipsis01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Ellipsis01Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Ellipsis01IconProps) {
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
        d="M19.217 9.885a2.126 2.126 0 1 1-2.332 2.332l-.01-.216.01-.219A2.126 2.126 0 0 1 19 9.875zm-14 0a2.126 2.126 0 1 1-2.332 2.332l-.01-.216.01-.219A2.126 2.126 0 0 1 5 9.875zm7 0a2.126 2.126 0 0 1-.218 4.24c-1.1 0-2.004-.836-2.113-1.908l-.01-.216.01-.219A2.126 2.126 0 0 1 12 9.875z"
      />
    </svg>
  );
}
