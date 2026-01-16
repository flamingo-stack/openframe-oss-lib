import type { SVGProps } from "react";
export interface MicOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MicOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MicOffIconProps) {
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
        d="M18.875 10.5a1.125 1.125 0 0 1 2.25 0c0 1.292-.27 2.524-.756 3.64l-.052.105a1.125 1.125 0 0 1-2.01-1.002l.128-.318c.284-.753.44-1.57.44-2.425m-4-.146V6a2.876 2.876 0 0 0-5.03-1.9L8.157 2.61A5.126 5.126 0 0 1 17.126 6v4.354a1.125 1.125 0 0 1-2.25 0Zm-5.03-6.255a1.125 1.125 0 0 1-1.688-1.49L9.844 4.1Zm-8.64-2.894a1.125 1.125 0 0 1 1.506-.078l.084.078 20 19.999.078.087a1.124 1.124 0 0 1-1.582 1.581l-.087-.077-4.487-4.486a9.1 9.1 0 0 1-3.591 1.246v1.32H15l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.005H9a1.125 1.125 0 1 1 0-2.25h1.875v-1.32c-4.51-.555-8.001-4.395-8.001-9.054a1.125 1.125 0 0 1 2.25 0A6.876 6.876 0 0 0 12 17.375l.293-.006a6.8 6.8 0 0 0 2.765-.718l-1.329-1.328A5.125 5.125 0 0 1 6.875 10.5V8.465l-5.67-5.67-.078-.086a1.125 1.125 0 0 1 .078-1.505Zm7.93 9.521a2.87 2.87 0 0 0 2.637 2.637z"
      />
    </svg>
  );
}
