import type { SVGProps } from "react";
export interface ChecksIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChecksIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChecksIconProps) {
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
        d="M1.203 12.097a1.125 1.125 0 0 1 1.506-.08l.085.077 4.626 4.605.076.087a1.125 1.125 0 0 1-1.579 1.585l-.085-.077-4.626-4.607-.078-.085a1.125 1.125 0 0 1 .075-1.505m11.419 1.151a1.125 1.125 0 1 1-1.68-1.496zm3.537-7.356a1.126 1.126 0 0 1 1.682 1.497l-5.22 5.859-.839-.748-.84-.748z"
      />
      <path
        fill={color}
        d="M21.16 5.751a1.126 1.126 0 0 1 1.68 1.498l-9.648 10.835a1.626 1.626 0 0 1-2.232.186l-.128-.116-4.626-4.607-.078-.085a1.125 1.125 0 0 1 1.581-1.586l.085.078 4.157 4.138 9.208-10.34Z"
      />
    </svg>
  );
}
