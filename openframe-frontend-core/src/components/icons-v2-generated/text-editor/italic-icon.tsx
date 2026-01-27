import type { SVGProps } from "react";
export interface ItalicIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ItalicIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ItalicIconProps) {
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
        d="m18.5 2.875.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-3.623l-3.437 13.75H14.5l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005h-9a1.125 1.125 0 0 1 0-2.25h3.621l3.438-13.75H9.5a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
