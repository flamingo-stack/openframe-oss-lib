import type { SVGProps } from "react";
export interface RadioWavesIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RadioWavesIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: RadioWavesIconProps) {
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
        d="M4.193 4.193a1 1 0 0 1 1.414 1.414c-3.4 3.4-3.506 8.918-.319 12.45l.319.336.07.075a1 1 0 0 1-1.408 1.408l-.076-.069-.39-.41C-.094 15.08.036 8.35 4.193 4.193"
      />
      <path
        fill={color}
        d="M7.078 7.008a1 1 0 0 1 1.444 1.384c-1.877 1.959-1.916 5.002-.187 6.92l.172.181.069.076a1 1 0 0 1-1.407 1.406l-.076-.068-.246-.258c-2.45-2.715-2.348-6.95.23-9.641ZM13 12a1 1 0 1 0-2 0 1 1 0 0 0 2 0m2 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0m.493-4.907a1 1 0 0 1 1.338-.068l.076.068.245.258c2.45 2.715 2.35 6.95-.23 9.641a1 1 0 0 1-1.444-1.384c1.877-1.959 1.916-5.003.188-6.92l-.173-.181-.068-.076a1 1 0 0 1 .068-1.338"
      />
      <path
        fill={color}
        d="M18.393 4.193a1 1 0 0 1 1.338-.068l.076.068.39.41a10.96 10.96 0 0 1-.39 15.104 1 1 0 1 1-1.414-1.414 8.96 8.96 0 0 0 .318-12.351l-.318-.335-.068-.076a1 1 0 0 1 .068-1.338"
      />
    </svg>
  );
}
