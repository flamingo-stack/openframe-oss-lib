import type { SVGProps } from "react";
export interface MedicalCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MedicalCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MedicalCircleIconProps) {
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
        d="M11.125 10c0 .621-.504 1.125-1.125 1.125H8.125v1.75H10c.621 0 1.125.504 1.125 1.126v1.875h1.75V14c0-.622.504-1.125 1.126-1.125h1.875v-1.751H14A1.125 1.125 0 0 1 12.876 10V8.125h-1.751zm4-1.125H16c1.174 0 2.125.952 2.125 2.126V13A2.126 2.126 0 0 1 16 15.126h-.874V16A2.126 2.126 0 0 1 13 18.125h-2A2.126 2.126 0 0 1 8.876 16v-.874H8A2.126 2.126 0 0 1 5.875 13v-2c0-1.173.952-2.125 2.125-2.125h.875V8c0-1.173.952-2.125 2.126-2.125H13c1.174 0 2.126.952 2.126 2.125z"
      />
    </svg>
  );
}
