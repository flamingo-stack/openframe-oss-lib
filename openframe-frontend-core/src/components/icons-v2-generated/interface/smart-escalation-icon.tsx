import type { SVGProps } from "react";
export interface SmartEscalationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SmartEscalationIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SmartEscalationIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 90 90"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path
        stroke="var(--ods-open-yellow-base)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M28 35v14l21-21m13 19V33L41 54"
      />
    </svg>
  );
}
