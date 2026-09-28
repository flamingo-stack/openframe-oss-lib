package com.openframe.test.api.graphql;

/**
 * GraphQL documents for the assistant AI settings (openframe-saas-ai-agent {@code ai-settings.graphqls}),
 * served on {@code chat/graphql}: the two tenant-wide AI logic configs and the client assistant view.
 */
public class AiSettingsQueries {

    private static final String AI_CONFIG_FIELDS = """
            fragment aiConfigFields on AgentAiConfig {
                id
                agentType
                llmProvider
                providerModel
                answerStyle
                customPrompt
                quickActions { id name instructions }
                quickActionsIsDefault
                createdAt
                updatedAt
            }
            """;

    private static final String CLIENT_VIEW_FIELDS = """
            fragment clientViewFields on ClientView {
                id
                organizationId
                assistantName
                applicationTheme
                accentColor
                createdAt
                updatedAt
            }
            """;

    public static final String CLIENT_AI_CONFIG = """
            query ClientAiConfig {
                clientAiConfig { ...aiConfigFields }
            }
            """ + AI_CONFIG_FIELDS;

    public static final String ADMIN_AI_CONFIG = """
            query AdminAiConfig {
                adminAiConfig { ...aiConfigFields }
            }
            """ + AI_CONFIG_FIELDS;

    /** {@code organizationId} null → the tenant-wide default; set → that organization's override or null. */
    public static final String CLIENT_VIEW = """
            query ClientView($organizationId: ID) {
                clientView(organizationId: $organizationId) { ...clientViewFields }
            }
            """ + CLIENT_VIEW_FIELDS;

    public static final String UPDATE_CLIENT_AI_CONFIG = """
            mutation UpdateClientAiConfig($input: AgentAiConfigInput!) {
                updateClientAiConfig(input: $input) {
                    aiConfig { ...aiConfigFields }
                    userErrors { field message }
                }
            }
            """ + AI_CONFIG_FIELDS;

    public static final String UPDATE_ADMIN_AI_CONFIG = """
            mutation UpdateAdminAiConfig($input: AgentAiConfigInput!) {
                updateAdminAiConfig(input: $input) {
                    aiConfig { ...aiConfigFields }
                    userErrors { field message }
                }
            }
            """ + AI_CONFIG_FIELDS;

    public static final String UPDATE_CLIENT_VIEW = """
            mutation UpdateClientView($organizationId: ID, $input: ClientViewInput!) {
                updateClientView(organizationId: $organizationId, input: $input) {
                    view { ...clientViewFields }
                    userErrors { field message }
                }
            }
            """ + CLIENT_VIEW_FIELDS;

    /** Drops the organization's override; returns the tenant default view, or null when none is configured. */
    public static final String RESET_CLIENT_VIEW = """
            mutation ResetClientView($organizationId: ID!) {
                resetClientView(organizationId: $organizationId) {
                    view { ...clientViewFields }
                    userErrors { field message }
                }
            }
            """ + CLIENT_VIEW_FIELDS;
}
