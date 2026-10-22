package com.openframe.event.jobs.backfill.config;

import com.openframe.event.jobs.backfill.config.properties.EventBackfillProperties;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BackfillRunsStartupCheckTest {

    private final AggregateSpecRegistry specRegistry = mock(AggregateSpecRegistry.class);
    private final EventBackfillProperties properties = new EventBackfillProperties();

    @Test
    void aRunIdForATypeWithASpec_starts() {
        // setup
        when(specRegistry.types()).thenReturn(Set.of("organizations"));
        properties.setRuns(Map.of("organizations", "2026-10-22"));
        BackfillRunsStartupCheck check = new BackfillRunsStartupCheck(properties, specRegistry);

        // execution and verifications
        assertThatCode(check::afterSingletonsInstantiated).doesNotThrowAnyException();
    }

    @Test
    void aRunIdForATypeNoSpecHas_stopsTheService() {
        // setup
        when(specRegistry.types()).thenReturn(Set.of("organizations"));
        properties.setRuns(Map.of("organisations", "2026-10-22"));
        BackfillRunsStartupCheck check = new BackfillRunsStartupCheck(properties, specRegistry);

        // execution and verifications
        assertThatThrownBy(check::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("[organisations]")
                .hasMessageContaining("[organizations]");
    }
}
