import type { SVGProps } from "react";
export interface TransferAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TransferAltIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TransferAltIconProps) {
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
        d="M19.375 15v-4.284l-8.58 8.58a1.125 1.125 0 1 1-1.59-1.591l10.5-10.5a1.126 1.126 0 0 1 1.92.795v7a1.125 1.125 0 0 1-2.25 0m-6.17-10.295a1.125 1.125 0 1 1 1.59 1.59l-10.5 10.5A1.125 1.125 0 0 1 2.375 16V9a1.125 1.125 0 0 1 2.25 0v4.284l8.58-8.58Z"
      />
    </svg>
  );
}
