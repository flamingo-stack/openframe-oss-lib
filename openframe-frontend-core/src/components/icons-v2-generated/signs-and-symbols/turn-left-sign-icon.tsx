import type { SVGProps } from "react";
export interface TurnLeftSignIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TurnLeftSignIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TurnLeftSignIconProps) {
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
        d="M9.397 1.8a4.124 4.124 0 0 1 5.519.282l7.002 7.004a4.123 4.123 0 0 1 0 5.83l-7.002 7.002a4.123 4.123 0 0 1-5.83 0l-7.004-7.002a4.123 4.123 0 0 1 0-5.83l7.003-7.004zm3.928 1.873a1.873 1.873 0 0 0-2.507-.127l-.142.127-7.003 7.003a1.873 1.873 0 0 0 0 2.649l7.003 7.002a1.873 1.873 0 0 0 2.649 0l7.002-7.002a1.873 1.873 0 0 0 0-2.649z"
      />
      <path
        fill={color}
        d="M13.874 15v-.8c0-.579 0-.945-.023-1.222-.021-.264-.057-.346-.072-.375a.88.88 0 0 0-.382-.382c-.029-.015-.111-.05-.375-.072-.277-.023-.643-.023-1.222-.023h-.583l.579.578.076.087a1.124 1.124 0 0 1-1.582 1.582l-.085-.078-2.5-2.499a1.125 1.125 0 0 1 0-1.59l2.5-2.501a1.125 1.125 0 0 1 1.59 1.59l-.58.58h.585c.542 0 1.015 0 1.405.031.403.033.816.106 1.214.31a3.12 3.12 0 0 1 1.366 1.365c.203.399.276.811.309 1.214.032.39.03.864.03 1.405v.8a1.125 1.125 0 1 1-2.25 0"
      />
    </svg>
  );
}
