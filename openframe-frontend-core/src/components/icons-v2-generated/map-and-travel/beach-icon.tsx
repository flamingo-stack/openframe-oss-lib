import type { SVGProps } from "react";
export interface BeachIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BeachIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BeachIconProps) {
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
        d="M21.248 12.664a1.125 1.125 0 0 1 1.504 1.672L18.16 18.47l.689 2.406h3.15l.116.006a1.125 1.125 0 0 1 0 2.239l-.115.005H2a1.125 1.125 0 0 1 0-2.25h3.15l.502-1.75H4a1.125 1.125 0 0 1 0-2.25h12.568zM7.492 20.875h9.017l-.5-1.75H7.992z"
      />
      <path
        fill={color}
        d="M7.268 1.17a8.625 8.625 0 0 1 10.563 6.098 1.126 1.126 0 0 1-.795 1.378l-4.317 1.156-.03.01-.033.007-1.778.476.915 3.414.024.112a1.126 1.126 0 0 1-2.162.58l-.036-.11-.915-3.414-1.778.477-.031.01q-.02.005-.038.008l-4.31 1.156a1.127 1.127 0 0 1-1.377-.796A8.625 8.625 0 0 1 7.268 1.17M5.212 4.784a6.37 6.37 0 0 0-2.063 5.251l2.11-.565c-.287-1.426-.408-3.053-.047-4.686M7.957 3.74c-.843 1.625-.847 3.43-.52 5.148l3.542-.95c-.576-1.65-1.48-3.212-3.022-4.198m2.897-.468c1.13 1.234 1.84 2.703 2.304 4.082l2.11-.565a6.37 6.37 0 0 0-4.414-3.517"
      />
    </svg>
  );
}
