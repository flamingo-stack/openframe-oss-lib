import type { SVGProps } from "react";
export interface VacuumIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VacuumIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: VacuumIconProps) {
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
        d="M15.875 12.352a2.88 2.88 0 0 0-1.75 2.649v.874H15a.875.875 0 0 0 .875-.874zm6.25 5.915a1.125 1.125 0 0 1-2.25 0v-6.142h-1.75v2.876A3.125 3.125 0 0 1 15 18.125h-.876v2.25h4.553l.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006H14a2.126 2.126 0 0 1-2.126-2.125V15A5.126 5.126 0 0 1 17 9.876h.874V7.114a3.988 3.988 0 0 0-7.83-1.068l-3.96 14.256a1.126 1.126 0 0 1-2.168-.604l3.96-14.254a6.24 6.24 0 0 1 12.248 1.67V9.88A2.124 2.124 0 0 1 22.125 12v6.266Z"
      />
      <path
        fill={color}
        d="M6.381 18.875a2.13 2.13 0 0 1 1.75.918l.152.256.723 1.448A1.125 1.125 0 0 1 8 23.125H2a1.125 1.125 0 0 1-1.007-1.628l.724-1.448.152-.256a2.13 2.13 0 0 1 1.75-.918H6.38ZM20.874 20a.875.875 0 1 0-1.749 0 .875.875 0 0 0 1.75 0Zm2.25 0a3.125 3.125 0 1 1-6.25 0 3.125 3.125 0 0 1 6.25 0"
      />
    </svg>
  );
}
