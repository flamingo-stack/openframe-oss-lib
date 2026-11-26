package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class OsUpdatePolicyResponse {
    private String id;
    private String name;
    private OsUpdatePolicyTarget target;
    private List<OsUpdateRolloutRuleResponse> rolloutRules;
    private List<OsUpdateRestartDeadlineResponse> restartDeadlines;
    private String pilotTagId;
    private Instant createdAt;
    private Instant updatedAt;
}
