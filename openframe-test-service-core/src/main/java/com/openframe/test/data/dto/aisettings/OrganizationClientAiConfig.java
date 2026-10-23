package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Effective client AI config of one organization: its override, or the tenant default while inheritDefault is true
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrganizationClientAiConfig {
    private String organizationId;
    private Boolean inheritDefault;
    private String llmProvider;
    private String providerModel;
    private String answerStyle;
    private String customPrompt;
    private List<QuickAction> quickActions;
    private Boolean quickActionsIsDefault;
    private String updatedAt;
}
