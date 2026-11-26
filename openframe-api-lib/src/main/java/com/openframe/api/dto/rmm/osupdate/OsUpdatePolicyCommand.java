package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateDeviceClass;
import com.openframe.data.document.rmm.osupdate.OsUpdateInUseRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateMaintenanceWindow;
import com.openframe.data.document.rmm.osupdate.OsUpdateOfflineRule;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDialog;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartMode;
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
    private Map<OsUpdateDeviceClass, OsUpdateMaintenanceWindow> maintenanceWindows;
    private OsUpdateOfflineRule offlineRule;
    private OsUpdateInUseRule inUseRule;
    private boolean domainControllerRestartManual;
    private Map<OsUpdateDeviceClass, OsUpdateRestartMode> restartModes;
    private OsUpdateRestartDialog restartDialog;
}
