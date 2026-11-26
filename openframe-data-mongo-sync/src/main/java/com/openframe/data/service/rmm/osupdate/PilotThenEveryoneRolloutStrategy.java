package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Component
public class PilotThenEveryoneRolloutStrategy implements OsUpdateRolloutStrategy {

    @Override
    public OsUpdateRolloutMode getMode() {
        return OsUpdateRolloutMode.PILOT_THEN_EVERYONE;
    }

    @Override
    public Optional<Instant> findInstallFrom(OsUpdateRolloutRule osUpdateRolloutRule, Instant releasedAt,
                                             boolean pilotDevice) {
        int days = pilotDevice
                ? osUpdateRolloutRule.getDaysAfterRelease()
                : osUpdateRolloutRule.getDaysAfterRelease() + osUpdateRolloutRule.getDaysLaterToEveryone();
        return Optional.of(releasedAt.plus(days, ChronoUnit.DAYS));
    }
}
