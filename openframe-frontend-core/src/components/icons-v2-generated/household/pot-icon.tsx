import type { SVGProps } from "react";
export interface PotIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PotIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PotIconProps) {
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
        d="M21.094 7.88a1.124 1.124 0 0 1 1.027 1.214l-.695 8.332a5.125 5.125 0 0 1-5.106 4.699H7.68a5.125 5.125 0 0 1-5.106-4.7l-.695-8.331-.004-.116a1.125 1.125 0 0 1 2.231-.186l.015.114.694 8.332a2.876 2.876 0 0 0 2.865 2.637h8.64a2.876 2.876 0 0 0 2.865-2.637l.694-8.332a1.125 1.125 0 0 1 1.215-1.027Z"
      />
      <path
        fill={color}
        d="M13 1.875c1.173 0 2.125.952 2.125 2.125v.006l3.731.468a3.13 3.13 0 0 1 2.6 2.18l.375 1.221H22l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H2a1.125 1.125 0 0 1 0-2.25h.17l.375-1.22.075-.217a3.13 3.13 0 0 1 2.524-1.964l3.73-.468V4c0-1.173.952-2.125 2.126-2.125zM5.422 6.706a.88.88 0 0 0-.682.492l-.046.119-.171.558h14.953l-.171-.558a.88.88 0 0 0-.728-.61l-4.647-.582h-3.86z"
      />
    </svg>
  );
}
