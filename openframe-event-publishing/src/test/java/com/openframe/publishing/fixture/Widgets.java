package com.openframe.publishing.fixture;

import com.openframe.data.document.TenantScoped;
import com.openframe.publishing.api.PublishedAggregateSpec;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.api.PublishedEvent;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

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

    public static class WidgetSpec implements PublishedAggregateSpec<Widget, WidgetEvent> {
        @Override
        public PublishedAggregateType getType() {
            return PublishedAggregateType.ORGANIZATIONS;
        }

        @Override
        public WidgetEvent toEvent(Widget document) {
            if (FAILING_NAME.equals(document.getName())) {
                throw new IllegalStateException("spec failed");
            }
            return new WidgetEvent(document.getName());
        }
    }

    public static class UnversionedWidgetSpec implements PublishedAggregateSpec<UnversionedWidget, WidgetEvent> {
        @Override
        public PublishedAggregateType getType() {
            return PublishedAggregateType.ORGANIZATIONS;
        }

        @Override
        public WidgetEvent toEvent(UnversionedWidget document) {
            return new WidgetEvent(document.getName());
        }
    }
}
