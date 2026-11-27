package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateInUseRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateOfflineRule;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDialog;
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
    private List<OsUpdateMaintenanceWindowResponse> maintenanceWindows;
    private OsUpdateOfflineRule offlineRule;
    private OsUpdateInUseRule inUseRule;
    private boolean domainControllerRestartManual;
    private List<OsUpdateDeviceClassRestartModeResponse> restartModes;
    private OsUpdateRestartDialog restartDialog;
    private Instant createdAt;
    private Instant updatedAt;
}
