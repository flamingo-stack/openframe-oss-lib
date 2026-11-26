package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;

@Component
public class HoldRolloutStrategy implements OsUpdateRolloutStrategy {

    @Override
    public OsUpdateRolloutMode getMode() {
        return OsUpdateRolloutMode.HOLD;
    }

    @Override
    public Optional<Instant> findInstallFrom(OsUpdateRolloutRule osUpdateRolloutRule, Instant releasedAt,
                                             boolean pilotDevice) {
        return Optional.empty();
    }
}
