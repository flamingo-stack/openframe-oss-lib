import type { SVGProps } from "react";
export interface SignalBroadcast02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SignalBroadcast02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SignalBroadcast02IconProps) {
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
        d="M2.37 5.3a1.126 1.126 0 0 1 1.824 1.313l-.25.422a6.73 6.73 0 0 0 0 6.437l.25.423.057.1a1.125 1.125 0 0 1-1.88 1.213l-.068-.094-.173-.28a8.98 8.98 0 0 1 .173-9.44l.068-.093Zm19.326 9.814a1.125 1.125 0 0 1-1.89-1.219zM20.142 5.058a1.125 1.125 0 0 1 1.554.337 8.98 8.98 0 0 1 0 9.719l-1.89-1.219a6.73 6.73 0 0 0 0-7.282 1.126 1.126 0 0 1 .336-1.555M6.178 7.52a1.125 1.125 0 1 1 1.89 1.219 2.8 2.8 0 0 0 0 3.03 1.126 1.126 0 0 1-1.89 1.22 5.05 5.05 0 0 1 0-5.469m10.09-.337a1.125 1.125 0 0 1 1.488.243l.067.094.188.316a5.05 5.05 0 0 1-.188 5.152 1.126 1.126 0 0 1-1.892-1.218 2.8 2.8 0 0 0 .105-2.855l-.105-.176-.057-.1a1.126 1.126 0 0 1 .394-1.456M10.876 20v-7.95a2.12 2.12 0 0 1-.99-1.583l-.011-.217.012-.218A2.125 2.125 0 0 1 12 8.125l.216.01a2.126 2.126 0 0 1 1.907 2.115c0 .76-.4 1.424-.998 1.8V20a1.126 1.126 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
