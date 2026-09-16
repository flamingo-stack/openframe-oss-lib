package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Partial update for {@code updateClientAiConfig} / {@code updateAdminAiConfig}: an omitted field keeps
 * the stored value. Sending {@code quickActions} without {@code quickActionsIsDefault} sets the flag
 * to false, so a behaviour-neutral write-back sends both or neither.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentAiConfigInput {
    private String llmProvider;
    private String providerModel;
    private String answerStyle;
    private String customPrompt;
    private List<QuickActionInput> quickActions;
    private Boolean quickActionsIsDefault;

    /**
     * The input that writes {@code config} back exactly as read: every stored value echoed, quick
     * actions with their ids, and the default flag only together with the list so a legacy record
     * (flag null) is left untouched.
     */
    public static AgentAiConfigInput echoOf(AgentAiConfig config) {
        AgentAiConfigInputBuilder b = AgentAiConfigInput.builder()
                .llmProvider(config.getLlmProvider())
                .providerModel(config.getProviderModel())
                .answerStyle(config.getAnswerStyle())
                .customPrompt(config.getCustomPrompt());
        if (config.getQuickActionsIsDefault() != null) {
            b.quickActionsIsDefault(config.getQuickActionsIsDefault());
            if (config.getQuickActions() != null) {
                b.quickActions(config.getQuickActions().stream()
                        .map(q -> QuickActionInput.builder().id(q.getId()).name(q.getName()).instructions(q.getInstructions()).build())
                        .toList());
            }
        }
        return b.build();
    }
}
