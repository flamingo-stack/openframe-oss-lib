import type { SVGProps } from "react";
export interface ShellIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function ShellIcon({
    className = "",
    size = 24,
    color = 'white',
    ...props
}: ShellIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 48 48"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill="transparent"
                stroke={color}
                d="M6.5 8.4a2 2 0 0 0-2 2v27.2a2 2 0 0 0 2 2h35a2 2 0 0 0 2-2V10.4a2 2 0 0 0-2-2zM9 23.16l7.72 6L9 35.13v-12zm20.46 11.97h-11"
            />
        </svg>
    );
}
