package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;

import java.time.Instant;
import java.util.Optional;

public interface OsUpdateRolloutStrategy {

    OsUpdateRolloutMode getMode();

    // The moment from which the device may install the update. Empty = never on its own, a technician decides.
    Optional<Instant> findInstallFrom(OsUpdateRolloutRule osUpdateRolloutRule, Instant releasedAt,
                                      boolean pilotDevice);
}
