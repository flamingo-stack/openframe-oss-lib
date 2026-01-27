import type { SVGProps } from "react";
export interface RunningIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RunningIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: RunningIconProps) {
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
        d="M11.058 6.03a4.12 4.12 0 0 1 2.684.506l2.12 1.224.282.163.176.094a2.88 2.88 0 0 0 2.802-.157l1.274-.81a1.125 1.125 0 0 1 1.207 1.9l-1.274.809a5.12 5.12 0 0 1-4.588.455l-2.623 4.544 1.167 1.04.293.28a6.1 6.1 0 0 1 1.456 2.396l1.036 3.178.029.11a1.125 1.125 0 0 1-2.127.694l-.042-.107-1.035-3.177a3.9 3.9 0 0 0-.921-1.517l-.186-.177-3.302-2.941a3.125 3.125 0 0 1-.628-3.897l1.265-2.193-.058.01a3.88 3.88 0 0 0-2.657 1.707l-.116.188-1.047 1.815-1.95-1.125 1.049-1.815a6.13 6.13 0 0 1 4.382-2.993zM8.455 16.454a1.125 1.125 0 0 1 1.59 1.591l-.834.835a5.13 5.13 0 0 1-5.28 1.228l-.363-.141-1.012-.434a1.125 1.125 0 1 1 .888-2.067l1.01.433.204.079a2.88 2.88 0 0 0 2.962-.689zm2.351-4.689a.876.876 0 0 0 .176 1.092l.419.373 2.36-4.085-1.081-.624zm-4.561.402a1.125 1.125 0 0 1-1.95-1.125z"
      />
      <path
        fill={color}
        d="M16.783 3.746a.625.625 0 1 0-1.25 0 .625.625 0 0 0 1.25 0m2.25 0a2.874 2.874 0 1 1-5.749 0 2.874 2.874 0 0 1 5.749 0"
      />
    </svg>
  );
}
