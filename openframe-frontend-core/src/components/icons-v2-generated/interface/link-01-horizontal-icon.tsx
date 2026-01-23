import type { SVGProps } from "react";
export interface Link01HorizontalIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Link01HorizontalIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Link01HorizontalIconProps) {
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
        d="m16 10.875.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H8a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M.875 12A6.125 6.125 0 0 1 7 5.874h2l.115.006a1.126 1.126 0 0 1 0 2.238L9 8.125H7a3.875 3.875 0 0 0 0 7.75h1.999l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005h-2A6.126 6.126 0 0 1 .876 12Zm20 0A3.875 3.875 0 0 0 17 8.124h-2a1.125 1.125 0 0 1 0-2.25h2a6.125 6.125 0 0 1 0 12.25h-2a1.125 1.125 0 0 1 0-2.25h2A3.875 3.875 0 0 0 20.875 12"
      />
    </svg>
  );
}
