import type { SVGProps } from "react";
export interface CameraOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CameraOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CameraOffIconProps) {
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
        d="M20.875 17.344V9c0-1.036-.84-1.875-1.875-1.875h-1.465a2.13 2.13 0 0 1-1.607-.735l-.161-.211-1.37-2.054H9.603l-.204.305a1.125 1.125 0 1 1-1.872-1.248l.24-.36.16-.212c.4-.464.987-.735 1.608-.735h4.93c.62 0 1.207.272 1.608.735l.16.211 1.37 2.054h1.396A4.125 4.125 0 0 1 23.126 9v8.344a1.125 1.125 0 0 1-2.25 0ZM2.205 3.205a1.125 1.125 0 0 1 1.504-.078l.087.078 18 18 .076.085a1.125 1.125 0 0 1-1.582 1.583l-.085-.078-.704-.704q-.247.032-.502.034H5A4.125 4.125 0 0 1 .875 18V9c0-1.501.804-2.81 2.002-3.532l-.672-.673-.078-.085a1.125 1.125 0 0 1 .078-1.505M9.125 13a2.876 2.876 0 0 0 2.876 2.876c.38 0 .741-.077 1.073-.211l-3.741-3.74A2.9 2.9 0 0 0 9.125 13m-6 5c0 1.035.84 1.875 1.875 1.875h12.283l-2.545-2.545a5.1 5.1 0 0 1-2.737.796 5.126 5.126 0 0 1-4.332-7.867L4.583 7.173A1.875 1.875 0 0 0 3.125 9z"
      />
    </svg>
  );
}
