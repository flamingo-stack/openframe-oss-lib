package com.openframe.publishing.fixture;

import com.openframe.data.document.TenantScoped;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.model.ReconciliationResult;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.api.spec.PublishedEvent;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

// Test fixtures shared by the outbox tests: a published document, its event and its spec.
public final class Widgets {

    public static final String FAILING_NAME = "spec fails";

    private Widgets() {
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Document("it_widgets")
    public static class Widget implements TenantScoped {
        @Id
        private String id;
        private String tenantId;
        private String name;
        private String internal;
        @Version
        private Long version;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Document("it_unversioned_widgets")
    public static class UnversionedWidget {
        @Id
        private String id;
        private String name;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WidgetEvent implements PublishedEvent {
        private String name;
    }

    public static class WidgetSpec implements AggregateSpec<Widget, WidgetEvent> {
        @Override
        public String getType() {
            return "organizations";
        }

        @Override
        public WidgetEvent toEvent(Widget document) {
            if (FAILING_NAME.equals(document.getName())) {
                throw new IllegalStateException("spec failed");
            }
            return new WidgetEvent(document.getName());
        }

        @Override
        public List<Projection<WidgetEvent, ?>> projections() {
            return List.of(new WidgetProjection("widget-copies"));
        }
    }

    public static class UnversionedWidgetSpec implements AggregateSpec<UnversionedWidget, WidgetEvent> {
        @Override
        public String getType() {
            return "organizations";
        }

        @Override
        public WidgetEvent toEvent(UnversionedWidget document) {
            return new WidgetEvent(document.getName());
        }

        @Override
        public List<Projection<WidgetEvent, ?>> projections() {
            return List.of(new WidgetProjection("unversioned-widget-copies"));
        }
    }

    // A copy that does nothing: the publishing tests need a spec, not a real projection.
    @AllArgsConstructor
    public static class WidgetProjection implements Projection<WidgetEvent, Widget> {

        private final String name;

        @Override
        public String name() {
            return name;
        }

        @Override
        public void apply(PublishedRecord<WidgetEvent> record) {
        }

        @Override
        public Class<Widget> projectedClass() {
            return Widget.class;
        }

        @Override
        public Class<Widget> projectedViewClass() {
            return Widget.class;
        }

        @Override
        public ReconciliationResult reconcile(List<Widget> projectedItems) {
            return ReconciliationResult.allMatch();
        }
    }
}
