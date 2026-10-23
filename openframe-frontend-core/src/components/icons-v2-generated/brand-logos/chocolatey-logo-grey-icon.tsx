import type { SVGProps } from "react";
export interface ChocolateyLogoGreyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChocolateyLogoGreyIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChocolateyLogoGreyIconProps) {
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
        d="M4.334 20.16V3.63L2 3l1.199 2.65L2 7.732l1.199 2.082L2 11.896l1.199 2.019L2 15.997l1.199 2.082L2 20.918zM9.95 5.65l2.524-1.01 1.577 1.956 2.965-.504 1.199 3.659 1.198 4.669 1.83 1.893-.946 1.577L22 20.918l-2.587-.757H4.334V3.631h3.03zm2.46 2.27c-2.523-.945-4.606 1.389-5.3 3.281-1.072 3.028 1.515 5.678 4.48 3.66.757-.505 1.64-1.388 2.208-2.145.505-.757.19-1.451-.252-1.072-.442.378-1.578 1.198-2.776 1.45-1.451.316-2.27-.883-1.956-2.019.316-1.325 1.767-2.334 3.029-1.892.567.189.377.946.188 1.325-.504.945.19 1.072.505.757.947-1.01 1.515-2.713-.126-3.344m4.1 4.328c-.27-.27-.81-.17-1.203.224-.394.394-.494.933-.223 1.204s.81.171 1.204-.223.494-.934.223-1.205m.35-2.694c-.27-.271-.81-.17-1.205.223-.393.395-.493.934-.222 1.204.27.271.81.172 1.205-.222.394-.394.493-.934.222-1.205"
      />
    </svg>
  );
}
