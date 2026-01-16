import type { SVGProps } from "react";
export interface AlphabetXIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetXIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetXIconProps) {
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
        d="M15.52 3.448a1.125 1.125 0 0 1 1.96 1.104L13.289 12l4.19 7.45.052.103a1.125 1.125 0 0 1-1.95 1.097l-.061-.098L12 14.293l-3.52 6.258-.062.098a1.126 1.126 0 0 1-1.898-1.2l4.19-7.45-4.19-7.447-.051-.104a1.124 1.124 0 0 1 1.95-1.097l.06.097L12 9.706l3.521-6.258Z"
      />
    </svg>
  );
}
