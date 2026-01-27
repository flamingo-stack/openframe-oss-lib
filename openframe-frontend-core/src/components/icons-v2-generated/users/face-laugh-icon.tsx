import type { SVGProps } from "react";
export interface FaceLaughIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FaceLaughIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FaceLaughIconProps) {
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
        d="M16 13.875a1.126 1.126 0 0 1 .899 1.802A6.12 6.12 0 0 1 12 18.125a6.12 6.12 0 0 1-4.9-2.448 1.126 1.126 0 0 1 .9-1.802zm-1-4.748a.62.62 0 0 0-.126.373l.014.126a.6.6 0 0 0 .113.246zm1 .745a.6.6 0 0 0 .112-.246l.014-.126-.014-.126A.6.6 0 0 0 16 9.127zm-6.888-.498A.6.6 0 0 0 9 9.129v.741a.6.6 0 0 0 .112-.244l.013-.126zM8 9.129a.62.62 0 0 0-.125.37l.012.127A.6.6 0 0 0 8 9.87zm2.126.37a1.625 1.625 0 0 1-3.242.167L6.875 9.5l.009-.166A1.625 1.625 0 0 1 8.5 7.875l.166.009c.82.083 1.46.775 1.46 1.616Zm6.999 0a1.625 1.625 0 0 1-3.242.168l-.007-.167.007-.166a1.626 1.626 0 0 1 3.242.166Z"
      />
    </svg>
  );
}
