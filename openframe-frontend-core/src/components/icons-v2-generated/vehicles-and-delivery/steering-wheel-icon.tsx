import type { SVGProps } from "react";
export interface SteeringWheelIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SteeringWheelIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SteeringWheelIconProps) {
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
        d="m2.095 11.697.114.013 2.191.346a8.124 8.124 0 0 1 6.807 7.128l.286 2.56.006.115a1.125 1.125 0 0 1-2.224.247l-.019-.114-.284-2.56a5.876 5.876 0 0 0-4.923-5.154l-2.192-.346-.112-.023a1.126 1.126 0 0 1 .35-2.212m19.812 0a1.127 1.127 0 0 1 .236 2.235l-2.192.346a5.88 5.88 0 0 0-4.848 4.667l-.075.488-.284 2.559-.018.114a1.126 1.126 0 0 1-2.218-.362l.285-2.56.043-.339a8.13 8.13 0 0 1 6.764-6.79l2.191-.345zM7.247 6.913a17.13 17.13 0 0 1 10.169.206l4.686 1.562.107.042a1.126 1.126 0 0 1-.708 2.123l-.111-.03-4.686-1.562a14.88 14.88 0 0 0-8.832-.18l-.576.18-4.686 1.561-.111.03a1.125 1.125 0 0 1-.6-2.164l4.685-1.562z"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m-8.25.25a.624.624 0 1 0-1.249 0 .624.624 0 0 0 1.248 0Zm2.25 0a2.875 2.875 0 1 1-5.75 0 2.875 2.875 0 0 1 5.75 0m8.25-.25c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
    </svg>
  );
}
