import type { SVGProps } from "react";
export interface TransferVrSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TransferVrSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TransferVrSquareIconProps) {
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
        d="M8.875 8.5a1.125 1.125 0 0 1 2.25 0V17a1.126 1.126 0 0 1-1.92.796l-2.5-2.5-.078-.085a1.126 1.126 0 0 1 1.583-1.584l.085.078.58.58zm4 7V7a1.126 1.126 0 0 1 1.92-.795l2.5 2.5.078.085a1.126 1.126 0 0 1-1.584 1.582l-.084-.076-.58-.58V15.5a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
