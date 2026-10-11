import type { SVGProps } from "react";
export interface ThumbsDownClassicIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function ThumbsDownClassicIcon({
    className = "",
    size = 24,
    color = '#5EFAF0',
    ...props
}: ThumbsDownClassicIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 23 23"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                fill={color}
                d="M15.004 12.626V1.125a1.125 1.125 0 0 1 2.25 0v11.5a1.125 1.125 0 0 1-2.25 0"
            />
            <path
                fill={color}
                d="M20.004 9.625v-5.5c0-1.035-.84-1.875-1.875-1.875H5.204c-.926 0-1.712.675-1.853 1.59l-1.079 7A1.876 1.876 0 0 0 4.126 13h5.003c.622 0 1.125.504 1.125 1.126v4.5c0 .759.617 1.374 1.376 1.374h.246l3.212-7.804.077-.15c.2-.336.566-.545.965-.545h2c.97 0 1.768-.739 1.864-1.684zm2.25 0-.022.422a4.125 4.125 0 0 1-4.103 3.704h-1.246l-2.96 7.183a2.12 2.12 0 0 1-1.963 1.316h-.33a3.625 3.625 0 0 1-3.626-3.625v-3.374H4.126a4.126 4.126 0 0 1-4.077-4.754l1.077-6.999.074-.37A4.126 4.126 0 0 1 5.204 0h12.925a4.125 4.125 0 0 1 4.125 4.125z"
            />
        </svg>
    );
}
