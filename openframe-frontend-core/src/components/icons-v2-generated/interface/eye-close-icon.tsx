import type { SVGProps } from "react";
export interface EyeCloseIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EyeCloseIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EyeCloseIconProps) {
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
        d="M7.846 13.984a1.125 1.125 0 0 1 1.982 1.066L8.49 17.534a1.125 1.125 0 0 1-1.98-1.066zm6.783-.458a1.126 1.126 0 0 1 1.465.358l.059.099 1.337 2.484.05.104a1.125 1.125 0 0 1-1.972 1.06l-.058-.098-1.338-2.483-.05-.104a1.126 1.126 0 0 1 .507-1.42M3.355 10.555a1.125 1.125 0 1 1 1.59 1.59l-2.15 2.151-.085.076a1.125 1.125 0 0 1-1.506-1.668zm15.698-.002a1.126 1.126 0 0 1 1.506-.077l.085.077 2.15 2.15.078.087a1.126 1.126 0 0 1-1.582 1.582l-.086-.076-2.15-2.152-.078-.085a1.126 1.126 0 0 1 .077-1.505Z"
      />
      <path
        fill={color}
        d="M1.538 6.975a1.125 1.125 0 0 1 1.436.461l.05.103.166.351c.94 1.912 3.565 5.985 8.807 5.986 5.591 0 8.209-4.633 8.977-6.337L21.999 8l1.027.462c-.822 1.824-3.989 7.662-11.029 7.662-6.6 0-9.792-5.133-10.841-7.277L.974 8.46l-.042-.107c-.18-.54.075-1.14.606-1.38Zm19.436.564a1.126 1.126 0 0 1 2.052.924z"
      />
    </svg>
  );
}
