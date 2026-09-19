package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Filter for {@code dialogs(...)}: statuses (ACTIVE, ACTION_REQUIRED, ON_HOLD, RESOLVED, ARCHIVED), agent types, scope MY | ALL. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DialogFilterInput {
    private List<String> statuses;
    private List<String> agentTypes;
    private String scope;
}
