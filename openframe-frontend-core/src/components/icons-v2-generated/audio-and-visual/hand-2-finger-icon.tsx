import type { SVGProps } from "react";
export interface Hand2FingerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Hand2FingerIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Hand2FingerIconProps) {
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
        d="M10.876 10V6a.876.876 0 1 0-1.75 0v8.5a1.125 1.125 0 0 1-2.25 0v-1.873a1.63 1.63 0 0 0-1.28.688 2.55 2.55 0 0 0 .141 3.131l3.222 3.772.14.148c.346.326.805.509 1.285.509h5.248l.217-.012a1 1 0 0 0 .147-.032l.28-.109c1.393-.596 2.6-2.052 2.6-3.722v-3.002c0-.755-.454-1.438-1.152-1.73l-1.542-.643a2.13 2.13 0 0 1-1.305-1.96V4a.876.876 0 0 0-1.75 0v6a1.125 1.125 0 0 1-2.25 0Zm6.25-.42 1.465.613a4.125 4.125 0 0 1 2.535 3.806V17c0 2.74-1.905 4.916-3.99 5.802l-.421.16a3.2 3.2 0 0 1-.833.155l-.25.008h-5.248a4.13 4.13 0 0 1-2.985-1.278l-.151-.167-3.222-3.772a4.8 4.8 0 0 1-.268-5.896l.143-.187a3.88 3.88 0 0 1 2.975-1.449V6a3.126 3.126 0 0 1 4.148-2.951 3.126 3.126 0 0 1 6.103.95z"
      />
    </svg>
  );
}
