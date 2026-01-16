import type { SVGProps } from "react";
export interface ProjectorIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ProjectorIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ProjectorIconProps) {
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
        d="M7.205 3.705a1.125 1.125 0 0 1 1.505-.078l.085.078 1.5 1.5.078.085A1.126 1.126 0 0 1 8.79 6.872l-.085-.076-1.5-1.5-.078-.087a1.125 1.125 0 0 1 .078-1.504m12 0a1.125 1.125 0 1 1 1.59 1.59l-1.5 1.5a1.125 1.125 0 0 1-1.59-1.59zm-6.33.795V2a1.125 1.125 0 0 1 2.25 0v2.5a1.125 1.125 0 0 1-2.25 0m-5.5 12a1.374 1.374 0 0 1-2.743.141l-.007-.14.007-.141A1.375 1.375 0 0 1 6 15.125l.141.007A1.376 1.376 0 0 1 7.375 16.5"
      />
      <path
        fill={color}
        d="M20.875 15.5c0-.97-.738-1.77-1.684-1.866L19 13.626a5.125 5.125 0 0 1-10 0H5a1.874 1.874 0 0 0-1.875 1.875V17.5c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875zM14 9.626a2.876 2.876 0 1 0 0 5.752 2.876 2.876 0 0 0 0-5.752m9.125 7.875a4.12 4.12 0 0 1-4 4.118V22a1.125 1.125 0 0 1-2.25 0v-.375h-9.75V22a1.125 1.125 0 0 1-2.25 0v-.382a4.12 4.12 0 0 1-4-4.118v-2A4.125 4.125 0 0 1 5 11.377h3.999a5.127 5.127 0 0 1 10 0 4.125 4.125 0 0 1 4.126 4.125V17.5Z"
      />
    </svg>
  );
}
