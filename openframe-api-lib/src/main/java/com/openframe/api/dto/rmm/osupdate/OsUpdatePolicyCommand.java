package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import lombok.Builder;
import lombok.Value;

import java.util.Map;

@Value
@Builder
public class OsUpdatePolicyCommand {

    String name;

    OsUpdatePolicyTarget target;

    Map<OsUpdateUrgency, OsUpdateRolloutRule> rolloutRules;

    Map<OsUpdateUrgency, OsUpdateRestartDeadline> restartDeadlines;

    String pilotTagId;
}
