import type { SVGProps } from "react";
export interface PatchPolicyIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function PatchPolicyIcon({
    className = "",
    size = 24,
    color = "currentColor",
    ...props
}: PatchPolicyIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 90 90"
            width={size}
            height={size}
            className={className}
            {...props}
        >
            <path
                stroke="var(--ods-open-yellow-base)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M32 53a5 5 0 1 0 0 10 5 5 0 0 0 0-10m0 0V37m0 0a5 5 0 1 0 0-10 5 5 0 0 0 0 10m26 16a5 5 0 1 0 0 10 5 5 0 0 0 0-10m0 0V38a6 6 0 0 0-6-6h-7m0 0 5-5m-5 5 5 5"
            />
        </svg>
    );
}
