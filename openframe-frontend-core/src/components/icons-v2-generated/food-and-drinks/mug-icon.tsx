import type { SVGProps } from "react";
export interface MugIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MugIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MugIconProps) {
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
        d="M21 19.875a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25zM19.875 5.854a.954.954 0 0 0-1.07-.947v.002l-.682.085.002.006v3.284l1.268-1.269c.308-.308.482-.726.482-1.161m2.25 0a3.9 3.9 0 0 1-1.141 2.752l-2.879 2.877A7.123 7.123 0 0 1 11 18.125H9a7.125 7.125 0 0 1-7.125-7.126V5A3.125 3.125 0 0 1 5 1.876h10c.886 0 1.685.37 2.253.96l1.271-.159.002-.001.356-.024a3.203 3.203 0 0 1 3.243 3.203Zm-18 5.145A4.875 4.875 0 0 0 9 15.874h2A4.875 4.875 0 0 0 15.873 11V5a.9.9 0 0 0-.061-.325l-.047-.096A.87.87 0 0 0 15 4.125H5A.875.875 0 0 0 4.125 5z"
      />
    </svg>
  );
}
