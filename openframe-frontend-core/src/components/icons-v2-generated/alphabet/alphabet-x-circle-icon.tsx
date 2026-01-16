import type { SVGProps } from "react";
export interface AlphabetXCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetXCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetXCircleIconProps) {
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
        d="M10.73 16.552a1.126 1.126 0 0 1-1.96-1.103zm2.54-9.104a1.126 1.126 0 0 1 1.96 1.104L13.29 12l1.94 3.45a1.125 1.125 0 1 1-1.96 1.103L12 14.293l-1.27 2.259-.98-.553-.98-.55 1.94-3.45-1.94-3.447-.051-.104a1.124 1.124 0 0 1 1.95-1.097l.061.097L12 9.705z"
      />
    </svg>
  );
}
