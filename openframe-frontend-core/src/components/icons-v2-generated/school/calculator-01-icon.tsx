import type { SVGProps } from "react";
export interface Calculator01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Calculator01Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Calculator01IconProps) {
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
        d="M8.704 14.204a1.125 1.125 0 0 1 1.59 1.59L8.59 17.5l1.705 1.705.078.085a1.126 1.126 0 0 1-1.582 1.582l-.087-.076L7 19.09l-1.704 1.705a1.125 1.125 0 0 1-1.59-1.59L5.41 17.5l-1.705-1.705-.078-.085a1.126 1.126 0 0 1 1.583-1.582l.085.076L7 15.908zM20 5.875l.115.006a1.125 1.125 0 0 1 0 2.238L20 8.125h-6a1.125 1.125 0 0 1 0-2.25zm0 12.5.115.005a1.126 1.126 0 0 1 0 2.239l-.114.006h-6a1.125 1.125 0 0 1 0-2.25zm0-4 .115.006a1.126 1.126 0 0 1 0 2.239l-.114.005h-6a1.125 1.125 0 0 1 0-2.25zM5.875 10V8.125H4a1.125 1.125 0 0 1 0-2.25h1.875V4a1.125 1.125 0 0 1 2.25 0v1.875H10l.116.006A1.125 1.125 0 0 1 10 8.125H8.125V10a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
