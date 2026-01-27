import type { SVGProps } from "react";
export interface CreditCardShieldIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CreditCardShieldIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CreditCardShieldIconProps) {
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
        d="m9 11.874.115.006a1.126 1.126 0 0 1 0 2.239L9 14.124H6a1.125 1.125 0 0 1 0-2.25zm13-4.999.115.006a1.125 1.125 0 0 1 0 2.238L22 9.125H2a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M20.875 16.385 18.5 15.197l-2.375 1.188v1.738l.015.168c.07.407.39.906.977 1.45.472.436 1 .794 1.383 1.027.383-.233.911-.59 1.383-1.027.672-.621.992-1.185.992-1.618zm0-5.187V7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h6.284l.114.006a1.126 1.126 0 0 1 0 2.239l-.114.005H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7v4.198a1.125 1.125 0 1 1-2.25 0m2.25 6.925-.01.262c-.106 1.297-.976 2.335-1.704 3.009a11 11 0 0 1-1.75 1.3l-.395.232c-.418.232-.912.26-1.349.086l-.183-.086c-.417-.232-1.327-.774-2.146-1.532-.728-.674-1.597-1.712-1.702-3.01l-.01-.261v-2.125c0-.615.347-1.177.897-1.453l3-1.5.175-.074a1.63 1.63 0 0 1 1.104 0l.175.074 3 1.5.196.116c.436.3.701.799.702 1.338z"
      />
    </svg>
  );
}
