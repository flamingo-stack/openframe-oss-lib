import type { SVGProps } from "react";
export interface AutomatedDiagnosticsIconProps
    extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
    className?: string;
    size?: number;
    color?: string;
}
export function AutomatedDiagnosticsIcon({
    className = "",
    size = 24,
    color = "currentColor",
    ...props
}: AutomatedDiagnosticsIconProps) {
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
                d="M50.438 28.576c0-1.957-1.612-3.576-3.6-3.576h-3.675c-1.989 0-3.601 1.62-3.601 3.576 0 1.436-.932 2.716-2.194 3.436-1.264.72-2.841.862-4.106.144-1.723-.98-3.956-.415-4.95 1.28l-1.836 3.127c-.995 1.695-.376 3.88 1.348 4.859 1.264.718 1.93 2.142 1.93 3.578s-.666 2.86-1.93 3.578c-1.724.98-2.343 3.164-1.348 4.86l1.835 3.126c.995 1.695 3.228 2.26 4.951 1.28 1.265-.718 2.842-.576 4.106.144 1.262.72 2.194 2 2.194 3.436 0 1.957 1.612 3.576 3.601 3.576h3.674c1.989 0 3.601-1.62 3.601-3.576 0-1.435.932-2.716 2.195-3.436s2.84-.862 4.105-.144c1.723.979 3.956.415 4.95-1.28l1.836-3.127c.995-1.696.376-3.88-1.348-4.86-1.264-.718-1.93-2.141-1.93-3.577s.666-2.86 1.93-3.578c1.724-.979 2.343-3.163 1.348-4.86l-1.836-3.126c-.994-1.695-3.227-2.259-4.95-1.28-1.264.718-2.842.576-4.105-.144s-2.195-2-2.195-3.436"
            />
            <path
                stroke="var(--ods-open-yellow-base)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M51 45a6 6 0 1 1-12 0 6 6 0 0 1 12 0"
            />
        </svg>
    );
}
