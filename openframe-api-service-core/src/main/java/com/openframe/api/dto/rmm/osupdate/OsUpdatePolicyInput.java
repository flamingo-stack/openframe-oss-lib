package com.openframe.api.dto.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdatePolicyInput {
    private String name;
    private OsUpdatePolicyTargetInput target;
    private List<OsUpdateRolloutRuleInput> rolloutRules;
    private List<OsUpdateRestartDeadlineInput> restartDeadlines;
    private String pilotTagId;
}
