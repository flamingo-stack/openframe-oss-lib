import type { SVGProps } from "react";
export interface MobilePhoneShieldIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MobilePhoneShieldIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MobilePhoneShieldIconProps) {
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
        d="M.875 19V5A4.125 4.125 0 0 1 5 .875h5.484l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H5c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h6c1.036 0 1.875-.84 1.875-1.875v-6.378a1.125 1.125 0 0 1 2.25 0V19A4.125 4.125 0 0 1 11 23.125H5A4.125 4.125 0 0 1 .875 19"
      />
      <path
        fill={color}
        d="m9 17.875.115.006a1.125 1.125 0 0 1 0 2.238L9 20.125H7a1.125 1.125 0 0 1 0-2.25zm10.875-13.49L17.5 3.197l-2.374 1.188v1.738l.014.168c.07.407.39.906.977 1.45.472.436 1 .794 1.383 1.027.383-.233.911-.59 1.383-1.027.672-.621.992-1.185.992-1.618zm2.25 1.738-.01.262c-.106 1.297-.976 2.335-1.704 3.009a11 11 0 0 1-1.75 1.3l-.395.232c-.418.232-.912.26-1.349.086l-.183-.086c-.417-.232-1.327-.774-2.146-1.532-.728-.674-1.597-1.712-1.702-3.01l-.01-.261V3.999c0-.616.347-1.178.897-1.454l3-1.5.175-.074a1.63 1.63 0 0 1 1.104 0l.175.074 3 1.5.196.116c.436.3.701.799.702 1.338z"
      />
    </svg>
  );
}
