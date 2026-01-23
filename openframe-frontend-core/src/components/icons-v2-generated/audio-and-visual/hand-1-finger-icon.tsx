import type { SVGProps } from "react";
export interface Hand1FingerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Hand1FingerIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Hand1FingerIconProps) {
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
        d="M6.876 14.5v-1.873a1.63 1.63 0 0 0-1.158.534l-.123.154a2.55 2.55 0 0 0 .142 3.131l3.222 3.772.14.148c.346.326.805.509 1.285.509h5.458c1.546-.444 3.034-2.021 3.034-3.875v-2.968c0-.766-.466-1.455-1.178-1.74l-4.987-1.997a2.125 2.125 0 0 1-1.335-1.971V4.25a1.125 1.125 0 0 0-2.25 0V14.5a1.125 1.125 0 0 1-2.25 0m6.75-6.263 4.908 1.966.287.128a4.13 4.13 0 0 1 2.305 3.701V17c0 3.1-2.438 5.487-4.852 6.09q-.134.035-.272.035h-5.618a4.13 4.13 0 0 1-2.985-1.278l-.151-.168-3.222-3.77a4.8 4.8 0 0 1-.268-5.897l.143-.187a3.88 3.88 0 0 1 2.975-1.449V4.25a3.376 3.376 0 0 1 6.75 0z"
      />
    </svg>
  );
}
