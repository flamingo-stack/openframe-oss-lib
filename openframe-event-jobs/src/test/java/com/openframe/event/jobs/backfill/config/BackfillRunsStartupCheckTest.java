package com.openframe.event.jobs.backfill.config;

import com.openframe.event.jobs.backfill.config.properties.EventBackfillProperties;
import com.openframe.publishing.api.spec.AggregateOrdering;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.config.EventsProperties;
import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(OutputCaptureExtension.class)
class BackfillRunsStartupCheckTest {

    private final AggregateSpecRegistry specRegistry = mock(AggregateSpecRegistry.class);
    private final AggregateSpec<?, ?> versionedSpec = mock(AggregateSpec.class);
    private final AggregateSpec<?, ?> unorderedSpec = mock(AggregateSpec.class);
    private final EventBackfillProperties properties = new EventBackfillProperties();
    private final PublishedAggregateTopics organizationsSwitchedOn = organizationsSwitchedOn();

    @Test
    void aRunIdForATypeWithASpec_starts() {
        // setup
        when(specRegistry.types()).thenReturn(Set.of("organizations"));
        stubSpec("organizations", versionedSpec, AggregateOrdering.VERSIONED);
        properties.setRuns(Map.of("organizations", "2026-10-22"));
        BackfillRunsStartupCheck check = new BackfillRunsStartupCheck(properties, specRegistry, organizationsSwitchedOn);

        // execution and verifications
        assertThatCode(check::afterSingletonsInstantiated).doesNotThrowAnyException();
    }

    @Test
    void aRunIdForATypeNoSpecHas_stopsTheService() {
        // setup
        when(specRegistry.types()).thenReturn(Set.of("organizations"));
        properties.setRuns(Map.of("organisations", "2026-10-22"));
        BackfillRunsStartupCheck check = new BackfillRunsStartupCheck(properties, specRegistry, organizationsSwitchedOn);

        // execution and verifications
        assertThatThrownBy(check::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("[organisations]")
                .hasMessageContaining("[organizations]");
    }

    @Test
    void aRunIdForATypeSwitchedOff_logsOneWarn_andStarts(CapturedOutput output) {
        // setup
        when(specRegistry.types()).thenReturn(Set.of("organizations", "users"));
        stubSpec("users", versionedSpec, AggregateOrdering.VERSIONED);
        properties.setRuns(Map.of("users", "2026-10-23"));
        BackfillRunsStartupCheck check = new BackfillRunsStartupCheck(properties, specRegistry, organizationsSwitchedOn);

        // execution
        check.afterSingletonsInstantiated();

        // verifications
        assertThat(output).contains("WARN").contains("Backfill run ids are set for [users]");
    }

    @Test
    void aRunIdForATypeSwitchedOn_logsNoWarn(CapturedOutput output) {
        // setup
        when(specRegistry.types()).thenReturn(Set.of("organizations"));
        stubSpec("organizations", versionedSpec, AggregateOrdering.VERSIONED);
        properties.setRuns(Map.of("organizations", "2026-10-22"));
        BackfillRunsStartupCheck check = new BackfillRunsStartupCheck(properties, specRegistry, organizationsSwitchedOn);

        // execution
        check.afterSingletonsInstantiated();

        // verifications
        assertThat(output).doesNotContain("Backfill run ids are set for");
    }

    @Test
    void aRunIdForAnUnorderedType_stopsTheService() {
        // setup
        when(specRegistry.types()).thenReturn(Set.of("organizations", "tags"));
        stubSpec("organizations", versionedSpec, AggregateOrdering.VERSIONED);
        stubSpec("tags", unorderedSpec, AggregateOrdering.UNORDERED);
        properties.setRuns(Map.of("organizations", "2026-10-22", "tags", "2026-11-19"));
        BackfillRunsStartupCheck check = new BackfillRunsStartupCheck(properties, specRegistry, organizationsSwitchedOn);

        // execution and verifications
        assertThatThrownBy(check::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("openframe.events.jobs.backfill.runs names [tags], but those types are UNORDERED: they publish"
                        + " without versions and cannot be backfilled; remove the run ids");
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void stubSpec(String type, AggregateSpec spec, AggregateOrdering ordering) {
        when(spec.ordering()).thenReturn(ordering);
        when(specRegistry.specOf(type)).thenReturn(spec);
    }

    private static PublishedAggregateTopics organizationsSwitchedOn() {
        EventsProperties events = new EventsProperties();
        events.setEnabled(true);
        EventsProperties.Topic organizations = new EventsProperties.Topic();
        organizations.setEnabled(true);
        events.getTopics().put("organizations", organizations);
        return new PublishedAggregateTopics(events);
    }
}
