package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * AI logic settings of one assistant (CLIENT = Fae, ADMIN = Mingo), tenant-wide, as exposed by
 * {@code clientAiConfig} / {@code adminAiConfig} on {@code chat/graphql} (openframe-saas-ai-agent
 * {@code ai-settings.graphqls}). {@code id} is null on the synthetic default the service returns before
 * the tenant first saves the config.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AgentAiConfig {
    private String id;
    private String agentType;
    private String llmProvider;
    private String providerModel;
    private String answerStyle;
    private String customPrompt;
    private List<QuickAction> quickActions;
    private Boolean quickActionsIsDefault;
    private String createdAt;
    private String updatedAt;
}
