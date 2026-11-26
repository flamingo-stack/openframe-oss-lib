package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdateRolloutStrategiesTest {

    private static final Instant RELEASED_AT = Instant.parse("2026-10-13T17:00:00Z");

    private final OsUpdateRolloutRule osUpdateRolloutRule = OsUpdateRolloutRule.builder()
            .daysAfterRelease(1).daysLaterToEveryone(3).build();

    @Test
    void pilotThenEveryone_pilotDevice_releasePlusTheFirstDays() {
        // execution
        Optional<Instant> installFrom = new PilotThenEveryoneRolloutStrategy()
                .findInstallFrom(osUpdateRolloutRule, RELEASED_AT, true);

        // verifications
        assertThat(installFrom).contains(Instant.parse("2026-10-14T17:00:00Z"));
    }

    @Test
    void pilotThenEveryone_deviceOutsideThePilotRing_releasePlusBothDays() {
        // execution
        Optional<Instant> installFrom = new PilotThenEveryoneRolloutStrategy()
                .findInstallFrom(osUpdateRolloutRule, RELEASED_AT, false);

        // verifications
        assertThat(installFrom).contains(Instant.parse("2026-10-17T17:00:00Z"));
    }

    @Test
    void everyoneAtOnce_anyDevice_releasePlusTheFirstDays() {
        // setup
        EveryoneAtOnceRolloutStrategy everyoneAtOnceRolloutStrategy = new EveryoneAtOnceRolloutStrategy();

        // execution
        Optional<Instant> ofPilotDevice =
                everyoneAtOnceRolloutStrategy.findInstallFrom(osUpdateRolloutRule, RELEASED_AT, true);
        Optional<Instant> ofOtherDevice =
                everyoneAtOnceRolloutStrategy.findInstallFrom(osUpdateRolloutRule, RELEASED_AT, false);

        // verifications
        assertThat(ofPilotDevice).contains(Instant.parse("2026-10-14T17:00:00Z"));
        assertThat(ofOtherDevice).contains(Instant.parse("2026-10-14T17:00:00Z"));
    }

    @Test
    void hold_anyDevice_never() {
        // setup
        HoldRolloutStrategy holdRolloutStrategy = new HoldRolloutStrategy();

        // execution
        Optional<Instant> ofPilotDevice = holdRolloutStrategy.findInstallFrom(osUpdateRolloutRule, RELEASED_AT, true);
        Optional<Instant> ofOtherDevice =
                holdRolloutStrategy.findInstallFrom(osUpdateRolloutRule, RELEASED_AT, false);

        // verifications
        assertThat(ofPilotDevice).isEmpty();
        assertThat(ofOtherDevice).isEmpty();
    }

    @Test
    void resolver_everyMode_theStrategyOfThatMode() {
        // setup
        PilotThenEveryoneRolloutStrategy pilotThenEveryone = new PilotThenEveryoneRolloutStrategy();
        EveryoneAtOnceRolloutStrategy everyoneAtOnce = new EveryoneAtOnceRolloutStrategy();
        HoldRolloutStrategy hold = new HoldRolloutStrategy();

        // execution
        OsUpdateRolloutStrategyResolver osUpdateRolloutStrategyResolver =
                new OsUpdateRolloutStrategyResolver(List.of(hold, pilotThenEveryone, everyoneAtOnce));

        // verifications
        assertThat(osUpdateRolloutStrategyResolver.resolve(OsUpdateRolloutMode.PILOT_THEN_EVERYONE))
                .isSameAs(pilotThenEveryone);
        assertThat(osUpdateRolloutStrategyResolver.resolve(OsUpdateRolloutMode.EVERYONE_AT_ONCE))
                .isSameAs(everyoneAtOnce);
        assertThat(osUpdateRolloutStrategyResolver.resolve(OsUpdateRolloutMode.HOLD)).isSameAs(hold);
    }
}
