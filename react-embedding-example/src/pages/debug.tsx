import { ProxyCredentialsPanel } from "@flamingo-stack/openframe-frontend-core/components/chat";

/**
 * `/debug` — the example's paste-creds page, the SAME panel as the hub's own
 * `/debug` admin surface (`ProxyCredentialsPanel`): paste a platform API key
 * (minted in the hub's `/admin/api-keys`), the user to act as and any optional
 * header, and they persist to localStorage (`chat.proxy-auth.v1`). Every
 * embedded surface (chat, tickets, the MCP playground) attaches them — the
 * reverse proxy stays a credential-free path rewriter.
 */
export function DebugPage() {
    return (
        <div className="mx-auto max-w-3xl space-y-[var(--spacing-system-lf)] px-[var(--spacing-system-mf)] py-[var(--spacing-system-xl)] text-ods-text-primary">
            <header className="space-y-[var(--spacing-system-xsf)]">
                <h1 className="text-h2">Debug credentials</h1>
                <p className="text-h6 text-ods-text-secondary">
                    Chat, tickets and the MCP playground attach these on every
                    call.
                </p>
            </header>
            <ProxyCredentialsPanel />
        </div>
    );
}
