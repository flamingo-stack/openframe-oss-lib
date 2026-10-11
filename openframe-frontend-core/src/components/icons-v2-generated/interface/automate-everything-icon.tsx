import type { SVGProps } from "react";
export interface AutomateEverythingIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function AutomateEverythingIcon({
    className = "",
    size = 24,
    color = "currentColor",
    ...props
}: AutomateEverythingIconProps) {
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
                fill="var(--ods-open-yellow-base)"
                d="M7.375 7V5.641c-1.842 1.776-3.25 3.414-3.25 6.36a7.88 7.88 0 0 0 4.966 7.322l.284.107.107.044a1.125 1.125 0 0 1-.747 2.109l-.11-.032-.365-.138a10.13 10.13 0 0 1-6.385-9.411c0-3.73 1.892-6.013 3.813-7.877H4.5a1.125 1.125 0 0 1 0-2.25h4a1.12 1.12 0 0 1 .771.31c.007.008.018.012.025.02q.008.01.016.022.053.056.098.118A1.12 1.12 0 0 1 9.625 3v4a1.126 1.126 0 0 1-2.25 0M19.875 12a7.88 7.88 0 0 0-4.966-7.32l-.284-.107-.107-.044a1.125 1.125 0 0 1 .747-2.111l.11.034.365.137c3.739 1.487 6.385 5.138 6.385 9.41 0 3.73-1.89 6.011-3.81 7.875H19.5l.116.006a1.126 1.126 0 0 1 0 2.239l-.116.005h-4A1.125 1.125 0 0 1 14.374 21V17a1.125 1.125 0 0 1 2.25 0v1.36c1.843-1.776 3.251-3.414 3.251-6.36"
            />
        </svg>
    );
}
