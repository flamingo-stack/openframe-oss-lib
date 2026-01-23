import type { SVGProps } from "react";
export interface MugTeaIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MugTeaIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MugTeaIconProps) {
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
        d="M5.875 4a1.125 1.125 0 0 1 2.25 0v2.883c.563.062 1 .539 1 1.117v2c0 .621-.504 1.125-1.125 1.125H6A1.125 1.125 0 0 1 4.875 10V8c0-.579.438-1.057 1-1.119z"
      />
      <path
        fill={color}
        d="M20.875 6.854a.953.953 0 0 0-.964-.953l-.106.008-.681.085.002.006v3.284l1.268-1.269c.308-.308.48-.726.48-1.161Zm2.25 0c0 1.032-.41 2.022-1.14 2.752l-2.86 2.86V14a7.126 7.126 0 0 1-7.124 7.124H8A7.125 7.125 0 0 1 .875 14V6A3.125 3.125 0 0 1 4 2.875h12c.886 0 1.685.37 2.252.96l1.273-.159v-.001l.356-.024a3.2 3.2 0 0 1 3.244 3.203M3.125 14A4.875 4.875 0 0 0 8 18.875h4a4.876 4.876 0 0 0 4.875-4.874V6a.9.9 0 0 0-.063-.326l-.045-.096A.88.88 0 0 0 16 5.125H4A.875.875 0 0 0 3.126 6z"
      />
    </svg>
  );
}
