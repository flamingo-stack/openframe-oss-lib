import type { SVGProps } from "react";
export interface TurnRightSignIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TurnRightSignIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TurnRightSignIconProps) {
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
        d="M9.397 1.8a4.124 4.124 0 0 1 5.519.282l7.002 7.004.282.312a4.124 4.124 0 0 1-.282 5.518l-7.002 7.002a4.124 4.124 0 0 1-5.519.282l-.312-.282-7.003-7.002a4.123 4.123 0 0 1 0-5.83l7.003-7.004.312-.283Zm3.928 1.873a1.874 1.874 0 0 0-2.649 0l-7.003 7.003a1.873 1.873 0 0 0 0 2.649l7.003 7.002a1.873 1.873 0 0 0 2.649 0l7.002-7.002.129-.142c.56-.687.56-1.678 0-2.364l-.13-.143z"
      />
      <path
        fill={color}
        d="M7.875 15v-.8c0-.541-.001-1.015.03-1.405.034-.403.108-.815.311-1.214a3.13 3.13 0 0 1 1.366-1.366c.398-.203.81-.276 1.212-.309.39-.032.865-.03 1.407-.03h.584l-.58-.58-.078-.085a1.125 1.125 0 0 1 1.582-1.584l.087.078 2.499 2.5c.44.44.44 1.152 0 1.591l-2.5 2.499a1.125 1.125 0 1 1-1.59-1.59l.579-.58H12.2c-.579 0-.946.001-1.223.024-.264.022-.347.057-.375.072a.88.88 0 0 0-.383.382c-.015.03-.05.112-.072.375a17 17 0 0 0-.023 1.222v.8a1.125 1.125 0 1 1-2.25 0Z"
      />
    </svg>
  );
}
