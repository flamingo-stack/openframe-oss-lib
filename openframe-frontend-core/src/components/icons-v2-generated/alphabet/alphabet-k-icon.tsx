import type { SVGProps } from "react";
export interface AlphabetKIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetKIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetKIconProps) {
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
        d="M6.375 20V4a1.125 1.125 0 0 1 2.25 0v6.939l.363-.428a1.1 1.1 0 0 1 .37-.436l5.784-6.803.08-.085a1.126 1.126 0 0 1 1.635 1.541l-5.362 6.308 6.87 8.244.069.092a1.126 1.126 0 0 1-1.72 1.433l-.078-.085-6.62-7.944-1.391 1.636V20a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
