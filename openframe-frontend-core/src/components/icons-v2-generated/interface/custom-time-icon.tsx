import type { SVGProps } from "react";
export interface CustomTimeIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function CustomTimeIcon({
    className = "",
    size = 24,
    color = '#888888',
    ...props
}: CustomTimeIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill={color}
                d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126"
            />
            <path
                fill={color}
                d="M10.875 8.5a1.125 1.125 0 0 1 2.25 0v3.034l1.67 1.671.078.085a1.126 1.126 0 0 1-1.582 1.582l-.087-.076-2-2.001c-.21-.211-.329-.497-.329-.796z"
            />
        </svg>
    );
}
