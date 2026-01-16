import type { SVGProps } from "react";
export interface Medal02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Medal02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Medal02IconProps) {
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
        d="M18.875 5.778c0-.381-.083-.742-.228-1.07l-5.735 7.95a1.126 1.126 0 0 1-1.824 0L5.352 4.71a2.64 2.64 0 0 0 .275 2.622l3.875 5.364.063.097a1.126 1.126 0 0 1-1.815 1.311l-.072-.09L3.804 8.65a4.905 4.905 0 0 1 .88-6.675l.327-.244A4.9 4.9 0 0 1 7.778.875h8.443a4.9 4.9 0 0 1 3.095 1.099l.201.174a4.905 4.905 0 0 1 .68 6.501l-3.875 5.366-.072.089a1.126 1.126 0 0 1-1.752-1.408l3.875-5.364a2.65 2.65 0 0 0 .502-1.554M7.778 3.125a2.7 2.7 0 0 0-.724.1L12 10.077l4.946-6.852a2.7 2.7 0 0 0-.724-.1z"
      />
      <path
        fill={color}
        d="M15.876 17a3.875 3.875 0 1 0-7.751.002 3.875 3.875 0 0 0 7.75-.002Zm2.25 0a6.126 6.126 0 1 1-12.25 0 6.126 6.126 0 0 1 12.25 0"
      />
    </svg>
  );
}
