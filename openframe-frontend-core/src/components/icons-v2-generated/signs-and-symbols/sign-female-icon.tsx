import type { SVGProps } from "react";
export interface SignFemaleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SignFemaleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SignFemaleIconProps) {
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
        d="M19.875 7V5.727L15.75 9.851a1.125 1.125 0 0 1-1.59-1.59l4.13-4.133-1.293-.003-.114-.006a1.125 1.125 0 0 1 .12-2.244l4 .01q.103.001.201.021l.015.001c.028.006.054.018.082.025.044.013.09.023.133.041.038.016.072.039.108.059q.041.02.081.044l.017.013q.082.055.156.126c.08.08.14.172.19.267.018.032.039.063.053.098q.046.114.067.234.019.096.02.196V7a1.126 1.126 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M15.874 14a5.875 5.875 0 1 0-11.75 0 5.875 5.875 0 0 0 11.75 0m2.25 0a8.125 8.125 0 1 1-16.25-.002 8.125 8.125 0 0 1 16.25.003Z"
      />
    </svg>
  );
}
