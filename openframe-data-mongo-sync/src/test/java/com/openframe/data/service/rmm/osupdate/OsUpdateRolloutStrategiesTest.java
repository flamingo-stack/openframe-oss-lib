package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdateRolloutStrategiesTest {

    private static final Instant RELEASED_AT = Instant.parse("2026-10-13T17:00:00Z");

    private final OsUpdateRolloutRule osUpdateRolloutRule = OsUpdateRolloutRule.builder()
            .daysAfterRelease(1).daysLaterToEveryone(3).build();

    @Test
    void pilotThenEveryone_pilotDevice_releasePlusTheFirstDays() {
        // execution
        Instant installFrom = new PilotThenEveryoneRolloutStrategy()
                .findInstallFrom(osUpdateRolloutRule, RELEASED_AT, true);

        // verifications
        assertThat(installFrom).isEqualTo(Instant.parse("2026-10-14T17:00:00Z"));
    }

    @Test
    void pilotThenEveryone_deviceOutsideThePilotRing_releasePlusBothDays() {
        // execution
        Instant installFrom = new PilotThenEveryoneRolloutStrategy()
                .findInstallFrom(osUpdateRolloutRule, RELEASED_AT, false);

        // verifications
        assertThat(installFrom).isEqualTo(Instant.parse("2026-10-17T17:00:00Z"));
    }

    @Test
    void everyoneAtOnce_anyDevice_releasePlusTheFirstDays() {
        // setup
        EveryoneAtOnceRolloutStrategy everyoneAtOnceRolloutStrategy = new EveryoneAtOnceRolloutStrategy();

        // execution
        Instant ofPilotDevice =
                everyoneAtOnceRolloutStrategy.findInstallFrom(osUpdateRolloutRule, RELEASED_AT, true);
        Instant ofOtherDevice =
                everyoneAtOnceRolloutStrategy.findInstallFrom(osUpdateRolloutRule, RELEASED_AT, false);

        // verifications
        assertThat(ofPilotDevice).isEqualTo(Instant.parse("2026-10-14T17:00:00Z"));
        assertThat(ofOtherDevice).isEqualTo(Instant.parse("2026-10-14T17:00:00Z"));
    }

    @Test
    void hold_anyDevice_never() {
        // setup
        HoldRolloutStrategy holdRolloutStrategy = new HoldRolloutStrategy();

        // execution
        Instant ofPilotDevice = holdRolloutStrategy.findInstallFrom(osUpdateRolloutRule, RELEASED_AT, true);
        Instant ofOtherDevice =
                holdRolloutStrategy.findInstallFrom(osUpdateRolloutRule, RELEASED_AT, false);

        // verifications
        assertThat(ofPilotDevice).isNull();
        assertThat(ofOtherDevice).isNull();
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
