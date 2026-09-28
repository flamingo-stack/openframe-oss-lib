package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One quick action of {@code AgentAiConfigInput}; an omitted id makes the server mint one. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class QuickActionInput {
    private String id;
    private String name;
    private String instructions;
}
