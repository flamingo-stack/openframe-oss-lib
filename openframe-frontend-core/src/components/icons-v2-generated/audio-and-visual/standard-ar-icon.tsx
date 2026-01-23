import type { SVGProps } from "react";
export interface StandardArIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StandardArIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: StandardArIconProps) {
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
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
      <path
        fill={color}
        d="M6.225 8.14c.559-1.687 2.99-1.687 3.55 0l.05.175 1.769 7.424.022.113a1.125 1.125 0 0 1-2.178.52l-.033-.112-.39-1.635h-2.03l-.39 1.635a1.125 1.125 0 0 1-2.188-.521l1.77-7.424.05-.174Zm11.15 2.11c0-.621-.503-1.125-1.125-1.125h-1.124v2.25h1.124c.622 0 1.125-.504 1.125-1.125m-9.854 2.126h.959L8 10.366zm12.104-2.126a3.37 3.37 0 0 1-1.51 2.811l1.361 2.38.053.103a1.125 1.125 0 0 1-1.944 1.112l-.062-.098-1.675-2.933h-.723v2.374a1.125 1.125 0 0 1-2.25 0V8.25c0-.759.615-1.375 1.374-1.375h2.001a3.375 3.375 0 0 1 3.375 3.375"
      />
    </svg>
  );
}
