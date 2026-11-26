package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdatePolicyCommand {

    private String name;
    private OsUpdatePolicyTarget target;
    private Map<OsUpdateUrgency, OsUpdateRolloutRule> rolloutRules;
    private Map<OsUpdateUrgency, OsUpdateRestartDeadline> restartDeadlines;
    private String pilotTagId;
}
