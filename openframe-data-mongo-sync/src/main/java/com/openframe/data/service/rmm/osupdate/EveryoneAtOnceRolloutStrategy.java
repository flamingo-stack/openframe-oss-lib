package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Component
public class EveryoneAtOnceRolloutStrategy implements OsUpdateRolloutStrategy {

    @Override
    public OsUpdateRolloutMode getMode() {
        return OsUpdateRolloutMode.EVERYONE_AT_ONCE;
    }

    @Override
    public Optional<Instant> findInstallFrom(OsUpdateRolloutRule osUpdateRolloutRule, Instant releasedAt,
                                             boolean pilotDevice) {
        return Optional.of(releasedAt.plus(osUpdateRolloutRule.getDaysAfterRelease(), ChronoUnit.DAYS));
    }
}
