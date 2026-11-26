package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;

import java.time.Instant;

public interface OsUpdateRolloutStrategy {

    OsUpdateRolloutMode getMode();

    // The moment from which the device may install the update. Null = never on its own, a technician decides.
    Instant findInstallFrom(OsUpdateRolloutRule osUpdateRolloutRule, Instant releasedAt, boolean pilotDevice);
}
