import type { SVGProps } from "react";
export interface FlashlightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FlashlightIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FlashlightIconProps) {
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
        d="M9.705 12.705a1.125 1.125 0 1 1 1.59 1.59l-3 3a1.125 1.125 0 0 1-1.59-1.59zm0-8.5a1.126 1.126 0 0 1 1.506-.078l.085.078 8.5 8.5.076.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076-8.5-8.5-.078-.086a1.125 1.125 0 0 1 .078-1.505"
      />
      <path
        fill={color}
        d="M11.826 1.603a3.25 3.25 0 0 1 4.347.223l6.001 6.003a3.247 3.247 0 0 1 0 4.592l-1.835 1.834a3.25 3.25 0 0 1-1.51.855l-4.861 1.215a1 1 0 0 0-.463.262l-5.587 5.587a3.247 3.247 0 0 1-4.345.223l-.246-.223-1.501-1.5a3.25 3.25 0 0 1 0-4.593l5.587-5.586a1 1 0 0 0 .262-.463L8.891 5.17l.06-.213c.158-.487.43-.932.794-1.296l1.835-1.835zm2.754 1.813a.997.997 0 0 0-1.409 0l-1.835 1.836a1 1 0 0 0-.222.335l-.04.128-1.216 4.862a3.25 3.25 0 0 1-.854 1.508l-5.587 5.587a1 1 0 0 0 0 1.411l1.501 1.5.157.127a1 1 0 0 0 1.252-.127l5.587-5.587a3.25 3.25 0 0 1 1.51-.854l4.86-1.216a1 1 0 0 0 .464-.262l1.835-1.834.128-.157a1 1 0 0 0 0-1.097l-.128-.157z"
      />
    </svg>
  );
}
