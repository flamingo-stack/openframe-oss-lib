import type { SVGProps } from "react";
export interface MicrowaveIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MicrowaveIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MicrowaveIconProps) {
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
        d="M17.875 16V6.5a1.126 1.126 0 0 1 2.25 0V16a1.125 1.125 0 0 1-2.25 0m-11.75-.625h8.75v-8.25h-8.75zM8.766 8.65a1.125 1.125 0 0 1 .743 2.102l.129.236.115.252a1.84 1.84 0 0 1-.171 1.636 2.3 2.3 0 0 1-1.236.945 1.126 1.126 0 0 1-.856-2.073l-.129-.236a1.84 1.84 0 0 1 .057-1.888 2.3 2.3 0 0 1 1.237-.945zm3.89.03a1.125 1.125 0 0 1 .853 2.072l.13.236.115.252a1.84 1.84 0 0 1-.171 1.636 2.3 2.3 0 0 1-1.238.945 1.125 1.125 0 0 1-.856-2.074l-.127-.235a1.84 1.84 0 0 1 .056-1.888 2.3 2.3 0 0 1 1.237-.945ZM17.124 16c0 .898-.728 1.625-1.625 1.625h-10A1.625 1.625 0 0 1 3.875 16V6.5c0-.898.727-1.625 1.625-1.625h10c.897 0 1.624.727 1.625 1.625V16Z"
      />
      <path
        fill={color}
        d="M20.875 6c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10.5c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875zm2.25 10.5a4.12 4.12 0 0 1-4 4.118V21a1.125 1.125 0 0 1-2.25 0v-.375h-9.75V21a1.125 1.125 0 0 1-2.25 0v-.382a4.12 4.12 0 0 1-4-4.118V6A4.125 4.125 0 0 1 5 1.875h14A4.125 4.125 0 0 1 23.125 6z"
      />
    </svg>
  );
}
