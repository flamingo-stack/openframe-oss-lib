import type { SVGProps } from "react";
export interface Send03IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Send03Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Send03IconProps) {
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
        d="M11.156 14.45a1.125 1.125 0 1 1-1.591-1.589zm3.96-7.15a1.125 1.125 0 0 1 1.593 1.591l-5.553 5.56-1.591-1.59z"
      />
      <path
        fill={color}
        d="M19.08 1.008c2.322-.692 4.484 1.384 3.97 3.69l-.059.224-4.744 15.954c-.767 2.578-4.205 3.067-5.66.803l-1.792-2.792-3.25.326a2.136 2.136 0 0 1-2.347-2.125v-3.782l-2.892-1.883C.06 9.962.553 6.536 3.122 5.77L19.08 1.01ZM7.448 16.961l3.502-.35.227-.008a1.63 1.63 0 0 1 1.17.567l.137.182 1.998 3.11a.892.892 0 0 0 1.607-.228l4.746-15.953.03-.128a.897.897 0 0 0-1.142-.988L3.765 7.925a.898.898 0 0 0-.233 1.612l3.174 2.067.166.121c.363.308.576.763.576 1.245z"
      />
    </svg>
  );
}
