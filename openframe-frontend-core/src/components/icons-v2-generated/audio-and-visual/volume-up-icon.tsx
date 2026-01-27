import type { SVGProps } from "react";
export interface VolumeUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VolumeUpIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: VolumeUpIconProps) {
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
        d="M14.124 20c0 1.932-2.368 2.862-3.682 1.446l-4.932-5.32H4A3.126 3.126 0 0 1 .875 13v-2A3.125 3.125 0 0 1 4 7.876h1.508l4.935-5.315.126-.126c1.334-1.23 3.555-.299 3.555 1.572zM3.125 13c0 .483.391.875.875.876h1.564c.517 0 1.014.188 1.399.525l.158.154 4.753 5.126V4.325l-4.753 5.12c-.402.434-.966.68-1.557.68H4a.875.875 0 0 0-.875.875zm17.749-1c0-2.488-1.524-4.687-3.808-5.752l-.468-.198-.105-.045a1.125 1.125 0 0 1 .798-2.092l.11.037.31.123c3.16 1.339 5.413 4.361 5.413 7.928 0 3.68-2.4 6.781-5.723 8.05a1.125 1.125 0 0 1-.803-2.102c2.542-.97 4.276-3.294 4.276-5.949m-3.999 0c0-.327-.138-.68-.458-1.007l-.15-.138-.083-.08a1.125 1.125 0 0 1 1.456-1.7l.092.07.295.277c.658.676 1.098 1.564 1.098 2.579 0 1.158-.574 2.152-1.393 2.853a1.126 1.126 0 0 1-1.465-1.708c.426-.365.608-.771.608-1.146"
      />
    </svg>
  );
}
