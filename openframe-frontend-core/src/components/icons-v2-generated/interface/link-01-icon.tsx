import type { SVGProps } from "react";
export interface Link01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Link01Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Link01IconProps) {
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
        d="M14.205 8.205a1.125 1.125 0 1 1 1.59 1.59l-6 6a1.125 1.125 0 1 1-1.59-1.59z"
      />
      <path
        fill={color}
        d="M5.51 10.531a1.125 1.125 0 0 1 1.591 1.59l-1.986 1.987a3.378 3.378 0 0 0 4.777 4.777l1.986-1.986a1.125 1.125 0 1 1 1.591 1.59l-1.986 1.987a5.628 5.628 0 0 1-7.959-7.959zm7.216-7.206a5.628 5.628 0 0 1 7.949 7.949l-.2.21-1.986 1.985a1.125 1.125 0 0 1-1.59-1.59l1.986-1.987.231-.256a3.378 3.378 0 0 0-4.752-4.752l-.256.231-1.985 1.987a1.125 1.125 0 0 1-1.59-1.591l1.984-1.986.21-.2Z"
      />
    </svg>
  );
}
