import type { SVGProps } from "react";
export interface DeleteIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DeleteIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: DeleteIconProps) {
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
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H9.648c-.52 0-1.019.217-1.374.6L3.63 10.723a1.875 1.875 0 0 0 0 2.551l4.645 5.001.14.135c.34.298.778.464 1.234.464H19c1.035 0 1.875-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 21.125H9.648a4.13 4.13 0 0 1-3.023-1.318l-4.644-5a4.125 4.125 0 0 1 0-5.614l4.644-5.001.308-.297a4.13 4.13 0 0 1 2.715-1.02H19A4.125 4.125 0 0 1 23.125 7z"
      />
      <path
        fill={color}
        d="M16.705 7.705a1.125 1.125 0 0 1 1.59 1.59L15.59 12l2.706 2.706.076.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076L14 13.59l-2.705 2.706a1.125 1.125 0 0 1-1.59-1.59l2.704-2.707-2.704-2.704-.078-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078L14 10.409l2.706-2.704Z"
      />
    </svg>
  );
}
