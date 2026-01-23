import type { SVGProps } from "react";
export interface Scale01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Scale01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Scale01IconProps) {
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
        d="m14 15.876.116.005a1.125 1.125 0 0 1 0 2.239l-.116.005h-4a1.126 1.126 0 0 1 0-2.25zM12 5.875c3.05 0 5.081 1.062 6.078 1.753l.158.12c.694.59.81 1.517.517 2.246l-.069.154-1.401 2.802a2.13 2.13 0 0 1-1.902 1.175H8.618a2.13 2.13 0 0 1-1.749-.917l-.152-.258-1.4-2.802c-.4-.799-.284-1.903.604-2.52l.422-.274C7.441 6.688 9.331 5.875 12 5.875m0 2.25c-2.267 0-3.788.711-4.576 1.207l1.272 2.543h1.642l-.382-.957-.039-.11a1.126 1.126 0 0 1 2.079-.83l.048.104.718 1.793h2.543l1.27-2.541c-.788-.497-2.308-1.209-4.575-1.209"
      />
    </svg>
  );
}
