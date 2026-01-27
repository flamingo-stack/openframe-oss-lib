import type { SVGProps } from "react";
export interface QuestionSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function QuestionSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: QuestionSquareIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M12.876 10.01V10a.883.883 0 0 0-.877-.875c-.448 0-.834.311-.93.606a1.125 1.125 0 0 1-2.138-.697C9.356 7.727 10.67 6.875 12 6.875A3.133 3.133 0 0 1 15.125 10v.01c0 1.398-.863 2.191-1.493 2.62a10 10 0 0 1-.529.327 1.125 1.125 0 0 1-2.23-.207v-.3c0-.497.28-.824.42-.964a2.4 2.4 0 0 1 .424-.322c.304-.189.404-.225.65-.393.369-.251.508-.454.508-.761Zm.499 5.99a1.376 1.376 0 0 1-2.742.14l-.007-.14.007-.141A1.374 1.374 0 0 1 12 14.626l.14.007c.694.07 1.235.655 1.235 1.367"
      />
    </svg>
  );
}
