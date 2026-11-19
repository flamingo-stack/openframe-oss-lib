package com.openframe.publishing.api.spec;

import com.openframe.publishing.fixture.Widgets.WidgetSpec;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AggregateSpecTest {

    @Test
    void ordering_notOverridden_isVersioned() {
        // setup
        WidgetSpec spec = new WidgetSpec();

        // execution
        AggregateOrdering ordering = spec.ordering();

        // verifications
        assertThat(ordering).isEqualTo(AggregateOrdering.VERSIONED);
    }
}
