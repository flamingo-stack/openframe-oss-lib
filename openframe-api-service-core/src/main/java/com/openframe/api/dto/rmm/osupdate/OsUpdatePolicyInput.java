package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateInUseRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateOfflineRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDialog;
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
    private List<OsUpdateMaintenanceWindowInput> maintenanceWindows;
    private OsUpdateOfflineRule offlineRule;
    private OsUpdateInUseRule inUseRule;
    private boolean domainControllerRestartManual;
    private List<OsUpdateDeviceClassRestartModeInput> restartModes;
    private OsUpdateRestartDialog restartDialog;
}
