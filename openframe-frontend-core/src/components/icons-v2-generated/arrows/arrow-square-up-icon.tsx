import type { SVGProps } from "react";
export interface ArrowSquareUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowSquareUpIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ArrowSquareUpIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M10.876 16v-5.284l-2.08 2.08a1.125 1.125 0 0 1-1.591-1.59l4-4.001.085-.078a1.126 1.126 0 0 1 1.506.078l3.999 4 .078.085a1.126 1.126 0 0 1-1.583 1.582l-.086-.076-2.079-2.08V16a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
