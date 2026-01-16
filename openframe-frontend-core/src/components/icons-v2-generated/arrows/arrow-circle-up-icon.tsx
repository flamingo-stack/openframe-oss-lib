import type { SVGProps } from "react";
export interface ArrowCircleUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowCircleUpIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ArrowCircleUpIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M10.876 16v-5.284l-2.08 2.08a1.125 1.125 0 0 1-1.591-1.59l4-4.001.085-.078a1.126 1.126 0 0 1 1.506.078l3.999 4 .078.085a1.126 1.126 0 0 1-1.583 1.582l-.086-.076-2.079-2.08V16a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
