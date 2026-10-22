package com.openframe.publishing.registry;

import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.config.EventsConfiguration;
import com.openframe.publishing.config.PublishedAggregateStartupCheck;
import com.openframe.publishing.fixture.Widgets.Widget;
import com.openframe.publishing.fixture.Widgets.WidgetEvent;
import com.openframe.publishing.fixture.Widgets.WidgetProjection;
import com.openframe.publishing.fixture.Widgets.WidgetSpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AggregateSpecRegistryTest {

    @Test
    void aContextWithoutAnySpec_starts() {
        new ApplicationContextRunner()
                .withUserConfiguration(EventsConfiguration.class, AggregateSpecRegistry.class,
                        PublishedAggregateStartupCheck.class)
                .run(context -> assertThat(context).hasNotFailed());
    }

    @Test
    void hasSpec_isTrueOnlyForARegisteredType() {
        AggregateSpecRegistry withSpec = new AggregateSpecRegistry(provider(new WidgetSpec()), projectionBeans());
        AggregateSpecRegistry withoutSpec = new AggregateSpecRegistry(provider(), projectionBeans());

        assertThat(withSpec.hasSpec("organizations")).isTrue();
        assertThat(withoutSpec.hasSpec("organizations")).isFalse();
    }

    @Test
    void specOf_returnsTheRegisteredSpec_andRefusesAnUnknownType() {
        WidgetSpec spec = new WidgetSpec();
        AggregateSpecRegistry withSpec = new AggregateSpecRegistry(provider(spec), projectionBeans());
        AggregateSpecRegistry withoutSpec = new AggregateSpecRegistry(provider(), projectionBeans());

        assertThat(withSpec.specOf("organizations")).isSameAs(spec);
        assertThatThrownBy(() -> withoutSpec.specOf("organizations"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void specs_listsEveryRegisteredSpec() {
        WidgetSpec spec = new WidgetSpec();
        AggregateSpecRegistry registry = new AggregateSpecRegistry(provider(spec), projectionBeans());

        assertThat(registry.specs()).containsExactly(spec);
    }

    @Test
    void projections_listsTheProjectionsOfEverySpec() {
        WidgetProjection projection = new WidgetProjection("widget-copies");
        WidgetSpec spec = new WidgetSpec() {
            @Override
            public List<Projection<WidgetEvent, ?>> projections() {
                return List.of(projection);
            }
        };
        AggregateSpecRegistry registry = new AggregateSpecRegistry(provider(spec), projectionBeans());

        assertThat(registry.projections()).containsExactly(projection);
    }

    @Test
    void twoProjectionsWithOneName_failAtStartup() {
        WidgetSpec twoCopiesWithOneName = new WidgetSpec() {
            @Override
            public List<Projection<WidgetEvent, ?>> projections() {
                return List.of(new WidgetProjection("widget-copies"), new WidgetProjection("widget-copies"));
            }
        };

        assertThatThrownBy(() -> new AggregateSpecRegistry(provider(twoCopiesWithOneName), projectionBeans()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("widget-copies");
    }

    @Test
    void aSpecWithoutProjections_failsAtStartup() {
        WidgetSpec projectedNowhere = new WidgetSpec() {
            @Override
            public List<Projection<WidgetEvent, ?>> projections() {
                return List.of();
            }
        };

        assertThatThrownBy(() -> new AggregateSpecRegistry(provider(projectedNowhere), projectionBeans()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("no projection");
    }

    @Test
    void twoSpecsForTheSameType_failAtStartup() {
        assertThatThrownBy(() -> new AggregateSpecRegistry(provider(new WidgetSpec(), new WidgetSpec()), projectionBeans()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Two specs have the type organizations");
    }

    @Test
    void aTypeThatIsNotATopicSuffix_failsAtStartup() {
        WidgetSpec dotted = new WidgetSpec() {
            @Override
            public String getType() {
                return "Organizations.v2";
            }
        };

        assertThatThrownBy(() -> new AggregateSpecRegistry(provider(dotted), projectionBeans()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("\"Organizations.v2\"")
                .hasMessageContaining("lower case letters, digits and dashes");
    }

    @Test
    void aProjectionNameWithAColon_failsAtStartup_soTwoVersionIdsCannotBeTheSame() {
        WidgetSpec colonNamed = new WidgetSpec() {
            @Override
            public List<Projection<WidgetEvent, ?>> projections() {
                return List.of(new WidgetProjection("widget:copies"));
            }
        };

        assertThatThrownBy(() -> new AggregateSpecRegistry(provider(colonNamed), projectionBeans()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("\"widget:copies\"")
                .hasMessageContaining("lower case letters, digits and dashes");
    }

    @Test
    void types_listsTheTypeOfEverySpec() {
        AggregateSpecRegistry registry = new AggregateSpecRegistry(provider(new WidgetSpec()), projectionBeans());

        assertThat(registry.types()).containsExactly("organizations");
    }

    @Test
    void aProjectionBeanOfASpecsEventClass_isAddedToThatSpec() {
        WidgetProjection elsewhere = new WidgetProjection("widget-copies-elsewhere");

        AggregateSpecRegistry registry = new AggregateSpecRegistry(provider(new WidgetSpec()), projectionBeans(elsewhere));

        assertThat(registry.getProjections("organizations")).extracting(Projection::name)
                .containsExactlyInAnyOrder("widget-copies", "widget-copies-elsewhere");
        assertThat(registry.projections()).hasSize(2);
    }

    @Test
    void aProjectionListedByItsSpecAndAlsoABean_countsOnce() {
        WidgetProjection listed = new WidgetProjection("widget-copies");
        WidgetSpec spec = new WidgetSpec() {
            @Override
            public List<Projection<WidgetEvent, ?>> projections() {
                return List.of(listed);
            }
        };

        AggregateSpecRegistry registry = new AggregateSpecRegistry(provider(spec), projectionBeans(listed));

        assertThat(registry.getProjections("organizations")).containsExactly(listed);
    }

    @Test
    void aProjectionBeanOfAnEventNoSpecHas_failsAtStartup() {
        WidgetProjection orphan = new WidgetProjection("widget-copies-elsewhere");

        assertThatThrownBy(() -> new AggregateSpecRegistry(provider(), projectionBeans(orphan)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("no published aggregate spec");
    }

    @Test
    void aSubclassOfASpecsDocument_publishesWithThatSpec() {
        WidgetSpec spec = new WidgetSpec();
        AggregateSpecRegistry registry = new AggregateSpecRegistry(provider(spec), projectionBeans());

        assertThat(registry.hasSpecForDocument(SpecialWidget.class)).isTrue();
        assertThat(registry.specOfDocument(SpecialWidget.class)).isSameAs(spec);
    }

    static class SpecialWidget extends Widget {
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<Projection<?, ?>> projectionBeans(Projection<?, ?>... projections) {
        ObjectProvider<Projection<?, ?>> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenAnswer(invocation -> Stream.of(projections));
        return provider;
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<AggregateSpec<?, ?>> provider(AggregateSpec<?, ?>... specs) {
        ObjectProvider<AggregateSpec<?, ?>> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenAnswer(invocation -> Stream.of(specs));
        return provider;
    }
}
