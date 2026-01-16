import type { SVGProps } from "react";
export interface TransferVrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TransferVrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TransferVrIconProps) {
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
        d="M13.875 18V3a1.126 1.126 0 0 1 1.92-.795l5 5 .078.086a1.124 1.124 0 0 1-1.582 1.582l-.087-.078-3.079-3.08V18a1.125 1.125 0 1 1-2.25 0m-6-12a1.125 1.125 0 0 1 2.25 0v15a1.126 1.126 0 0 1-1.92.795l-5-5-.078-.086a1.125 1.125 0 0 1 1.583-1.582l.085.078 3.08 3.08z"
      />
    </svg>
  );
}
