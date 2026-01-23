import type { SVGProps } from "react";
export interface ElectricalPlugIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ElectricalPlugIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ElectricalPlugIconProps) {
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
        d="M7.875 19v-1a1.125 1.125 0 0 1 2.25 0v1c0 1.036.84 1.875 1.875 1.875h3c1.035 0 1.875-.84 1.875-1.875v-4A4.125 4.125 0 0 1 21 10.875h1l.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H21c-1.035 0-1.875.84-1.875 1.875v4A4.125 4.125 0 0 1 15 23.125h-3A4.125 4.125 0 0 1 7.875 19"
      />
      <path
        fill={color}
        d="M13.875 7a.875.875 0 0 0-.874-.875H5A.875.875 0 0 0 4.125 7v2.872c0 .454.165.893.464 1.235l2.387 2.728.148.185c.324.447.5.987.5 1.543v.937c0 .207.169.375.376.375h2a.376.376 0 0 0 .376-.375v-.937c0-.636.23-1.25.648-1.729l2.387-2.727.107-.132c.231-.319.357-.706.357-1.103zm2.25 2.872a4.13 4.13 0 0 1-.788 2.426l-.233.291-2.386 2.728a.37.37 0 0 0-.092.246v.937A2.626 2.626 0 0 1 10 19.125H8A2.626 2.626 0 0 1 5.375 16.5v-.937a.4.4 0 0 0-.053-.192l-.04-.054-2.386-2.728a4.13 4.13 0 0 1-1.021-2.717V7c0-1.329.83-2.46 2-2.913V2a1.125 1.125 0 0 1 2.25 0v1.875h5.75V2a1.125 1.125 0 0 1 2.25 0v2.087c1.17.452 2 1.584 2 2.913z"
      />
    </svg>
  );
}
