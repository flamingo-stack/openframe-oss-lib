package com.openframe.event.jobs.task.fixture;

import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.api.spec.PublishedEvent;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// A published type for the task tests: its spec names the event class the envelopes are read into.
public final class Widgets {

    public static final String TYPE = "widgets";

    private Widgets() {
    }

    public static AggregateSpecRegistry registryWith(Projection<WidgetEvent, ?> projection) {
        WidgetSpec spec = new WidgetSpec(projection);
        AggregateSpecRegistry specRegistry = mock(AggregateSpecRegistry.class);
        List<AggregateSpec<?, ?>> specs = List.of(spec);
        when(specRegistry.specs()).thenReturn(specs);
        List<Projection<?, ?>> projections = List.of(projection);
        when(specRegistry.projections()).thenReturn(projections);
        return specRegistry;
    }

    public static PublishedRecord<WidgetEvent> record(String tenantId, long version, String name, Instant renamedAt) {
        WidgetEvent event = new WidgetEvent("widget-1", name, renamedAt);
        return PublishedRecord.<WidgetEvent>builder()
                .tenantId(tenantId)
                .version(version)
                .schemaVersion(PublishedRecord.CURRENT_SCHEMA_VERSION)
                .event(event)
                .build();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WidgetEvent implements PublishedEvent {

        private String widgetId;
        private String name;
        private Instant renamedAt;
    }

    public static class Widget {
    }

    @AllArgsConstructor
    public static class WidgetSpec implements AggregateSpec<Widget, WidgetEvent> {

        private final Projection<WidgetEvent, ?> projection;

        @Override
        public String getType() {
            return TYPE;
        }

        @Override
        public WidgetEvent toEvent(Widget document) {
            return new WidgetEvent();
        }

        @Override
        public List<Projection<WidgetEvent, ?>> projections() {
            return List.of(projection);
        }
    }
}
