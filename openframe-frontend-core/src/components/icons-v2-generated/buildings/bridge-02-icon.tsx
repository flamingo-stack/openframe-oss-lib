import type { SVGProps } from "react";
export interface Bridge02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Bridge02Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Bridge02IconProps) {
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
        d="M10.876 7.95V3.153q-.878.04-1.751.143v4.952a1.125 1.125 0 0 1-2.25 0V3.664q-.88.186-1.75.437v5.077a1.125 1.125 0 0 1-2.25 0V4.864a24 24 0 0 0-.443.178 1.126 1.126 0 0 1-.864-2.078 27.13 27.13 0 0 1 20.864 0L22 4.002l-.431 1.04q-.221-.09-.444-.178v4.314a1.125 1.125 0 0 1-2.25 0V4.1a25 25 0 0 0-1.75-.437v4.584a1.125 1.125 0 0 1-2.25 0V3.296a25 25 0 0 0-1.75-.143V7.95a1.126 1.126 0 0 1-2.25 0Zm11.556-4.986a1.126 1.126 0 0 1-.863 2.078z"
      />
      <path
        fill={color}
        d="M19.125 20.875h1.75V10.736c-1.305-.523-4.542-1.61-8.874-1.611s-7.571 1.088-8.876 1.611v10.139h1.75V20a7.125 7.125 0 0 1 14.25 0zm4 .625c0 .898-.727 1.625-1.625 1.625h-3a1.624 1.624 0 0 1-1.625-1.625V20a4.875 4.875 0 0 0-9.75 0v1.5c0 .898-.728 1.625-1.625 1.625h-3A1.625 1.625 0 0 1 .875 21.5V10.309a1.6 1.6 0 0 1 .952-1.468l.536-.223C3.897 8.011 7.384 6.875 12 6.875c5.276 0 9.076 1.484 10.172 1.966l.214.114c.471.3.738.818.739 1.354z"
      />
    </svg>
  );
}
