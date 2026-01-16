import type { SVGProps } from "react";
export interface FeedbackIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FeedbackIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FeedbackIconProps) {
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
        d="M20.874 3.125H14.88l-1.23 4.913a.876.876 0 0 0 .85 1.087H18a1.125 1.125 0 0 1 1.038 1.556l-.514 1.244c-.28.676-.04 1.442.543 1.848l1.721-3.599.065-.183a1 1 0 0 0 .02-.195v-6.67Zm2.25 6.671c0 .35-.058.697-.172 1.026l-.132.322-1.833 3.833a2.013 2.013 0 0 1-2.694.944 3.786 3.786 0 0 1-1.958-4.546H14.5a3.125 3.125 0 0 1-3.032-3.882l1.25-5.008.052-.174A2.125 2.125 0 0 1 14.78.875H21c1.173 0 2.123.952 2.123 2.126zM3.112 8.84A2.01 2.01 0 0 1 5.516 8l.19.08.327.177a3.79 3.79 0 0 1 1.632 4.368h1.834a3.125 3.125 0 0 1 3.032 3.882l-1.25 5.008a2.126 2.126 0 0 1-2.062 1.61H3A2.126 2.126 0 0 1 .875 21v-6.796c0-.466.105-.927.306-1.347l1.831-3.834zm.013 12.035h5.996l1.227-4.913.02-.102a.876.876 0 0 0-.87-.985H6a1.126 1.126 0 0 1-1.04-1.556l.515-1.243a1.54 1.54 0 0 0-.544-1.852L3.21 13.826a.9.9 0 0 0-.085.378z"
      />
    </svg>
  );
}
