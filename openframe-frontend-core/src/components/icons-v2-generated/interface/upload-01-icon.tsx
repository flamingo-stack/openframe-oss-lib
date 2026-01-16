import type { SVGProps } from "react";
export interface Upload01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Upload01Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Upload01IconProps) {
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
        d="M21 19.875a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25zM10.874 15a1.125 1.125 0 0 0 2.25 0V7.715l3.081 3.08a1.125 1.125 0 0 0 1.59-1.59l-5-5a1.125 1.125 0 0 0-1.59 0l-5 5-.078.085a1.126 1.126 0 0 0 1.583 1.582l.085-.076 3.08-3.08V15Z"
      />
    </svg>
  );
}
