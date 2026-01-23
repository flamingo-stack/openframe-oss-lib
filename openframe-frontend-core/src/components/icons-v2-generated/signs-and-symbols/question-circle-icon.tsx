import type { SVGProps } from "react";
export interface QuestionCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function QuestionCircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: QuestionCircleIconProps) {
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
        d="M12.876 10.01V10a.883.883 0 0 0-.877-.875c-.448 0-.834.311-.93.606a1.125 1.125 0 0 1-2.138-.697C9.356 7.727 10.67 6.875 12 6.875A3.133 3.133 0 0 1 15.125 10v.01c0 1.398-.863 2.191-1.493 2.62a10 10 0 0 1-.529.327 1.125 1.125 0 0 1-2.23-.207v-.3c0-.497.28-.824.42-.964a2.4 2.4 0 0 1 .424-.322c.304-.189.404-.225.65-.393.369-.251.508-.454.508-.761Zm.499 5.99a1.376 1.376 0 0 1-2.742.14l-.007-.14.007-.141A1.374 1.374 0 0 1 12 14.626l.14.007c.694.07 1.235.655 1.235 1.367"
      />
    </svg>
  );
}
