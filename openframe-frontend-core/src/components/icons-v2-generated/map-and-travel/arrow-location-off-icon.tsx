import type { SVGProps } from "react";
export interface ArrowLocationOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowLocationOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ArrowLocationOffIconProps) {
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
        d="M19.766.995c1.979-.628 3.866 1.26 3.239 3.239l-.07.198-3.508 8.708-.048.105a1.125 1.125 0 0 1-2.039-.944l3.507-8.709.023-.102a.34.34 0 0 0-.36-.36l-.103.023-8.71 3.507a1.125 1.125 0 0 1-.84-2.086l8.711-3.509zM2.205 2.204a1.125 1.125 0 0 1 1.504-.077l.087.078 18 18 .076.085a1.125 1.125 0 0 1-1.582 1.583l-.085-.078-3.04-3.038-1.228 3.053c-.746 1.85-3.401 1.713-3.961-.193l-2.05-6.983a.83.83 0 0 0-.56-.56l-6.982-2.05C.477 11.466.338 8.809 2.189 8.063l3.053-1.23-3.037-3.037-.078-.085a1.125 1.125 0 0 1 .078-1.506Zm9.667 11.26q.131.255.213.535l1.927 6.567 1.425-3.537zm-8.44-3.477L10 11.915a3 3 0 0 1 .537.214L6.97 8.562z"
      />
    </svg>
  );
}
