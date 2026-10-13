package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Omitted field keeps stored value; quickActions without quickActionsIsDefault resets the flag to false.
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

    // Quick actions are only echoed alongside a non-null default flag, so legacy records stay untouched.
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
