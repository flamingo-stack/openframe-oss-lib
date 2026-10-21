package com.openframe.publishing.spec;

import com.openframe.publishing.api.PublishedAggregateSpec;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.config.EventsConfiguration;
import com.openframe.publishing.config.PublishedAggregateStartupCheck;
import com.openframe.publishing.fixture.Widgets.WidgetSpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PublishedAggregateSpecRegistryTest {

    @Test
    void aContextWithoutAnySpec_starts() {
        new ApplicationContextRunner()
                .withUserConfiguration(EventsConfiguration.class, PublishedAggregateSpecRegistry.class,
                        PublishedAggregateStartupCheck.class)
                .run(context -> assertThat(context).hasNotFailed());
    }

    @Test
    void hasSpec_isTrueOnlyForARegisteredType() {
        PublishedAggregateSpecRegistry withSpec = new PublishedAggregateSpecRegistry(provider(new WidgetSpec()));
        PublishedAggregateSpecRegistry withoutSpec = new PublishedAggregateSpecRegistry(provider());

        assertThat(withSpec.hasSpec(PublishedAggregateType.ORGANIZATIONS)).isTrue();
        assertThat(withoutSpec.hasSpec(PublishedAggregateType.ORGANIZATIONS)).isFalse();
    }

    @Test
    void specOf_returnsTheRegisteredSpec_andRefusesAnUnknownType() {
        WidgetSpec spec = new WidgetSpec();
        PublishedAggregateSpecRegistry withSpec = new PublishedAggregateSpecRegistry(provider(spec));
        PublishedAggregateSpecRegistry withoutSpec = new PublishedAggregateSpecRegistry(provider());

        assertThat(withSpec.specOf(PublishedAggregateType.ORGANIZATIONS)).isSameAs(spec);
        assertThatThrownBy(() -> withoutSpec.specOf(PublishedAggregateType.ORGANIZATIONS))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void twoSpecsForTheSameType_failAtStartup() {
        assertThatThrownBy(() -> new PublishedAggregateSpecRegistry(provider(new WidgetSpec(), new WidgetSpec())))
                .isInstanceOf(IllegalStateException.class);
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<PublishedAggregateSpec<?, ?>> provider(PublishedAggregateSpec<?, ?>... specs) {
        ObjectProvider<PublishedAggregateSpec<?, ?>> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenAnswer(invocation -> Stream.of(specs));
        return provider;
    }
}
