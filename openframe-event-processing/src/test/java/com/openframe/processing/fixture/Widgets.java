package com.openframe.processing.fixture;

import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.model.ReconciliationResult;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.api.spec.PublishedEvent;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

// A spec on the organizations topic whose projections record what reached them; the processing tests need no real document.
public final class Widgets {

    private Widgets() {
    }

    public static class WidgetEvent implements PublishedEvent {
    }

    public static class WidgetSpec implements AggregateSpec<Object, WidgetEvent> {

        private final List<Projection<WidgetEvent, ?>> projections;

        public WidgetSpec(List<Projection<WidgetEvent, ?>> projections) {
            this.projections = projections;
        }

        @Override
        public String getType() {
            return "organizations";
        }

        @Override
        public WidgetEvent toEvent(Object document) {
            return new WidgetEvent();
        }

        @Override
        public List<Projection<WidgetEvent, ?>> projections() {
            return projections;
        }
    }

    public static class RecordingProjection implements Projection<WidgetEvent, Object> {

        private final String name;
        private final Consumer<WidgetEvent> behaviour;
        public final List<PublishedRecord<WidgetEvent>> records = new CopyOnWriteArrayList<>();
        public final List<String> deletedAggregateIds = new CopyOnWriteArrayList<>();
        // What countChanges returns, before its limit.
        public volatile long changes;

        public RecordingProjection(String name) {
            this(name, event -> { });
        }

        public RecordingProjection(String name, Consumer<WidgetEvent> behaviour) {
            this.name = name;
            this.behaviour = behaviour;
        }

        @Override
        public String name() {
            return name;
        }

        @Override
        public void apply(PublishedRecord<WidgetEvent> record) {
            WidgetEvent event = record.getEvent();
            behaviour.accept(event);
            records.add(record);
        }

        @Override
        public void applyDelete(String tenantId, String aggregateId) {
            deletedAggregateIds.add(aggregateId);
        }

        @Override
        public long countChanges(PublishedRecord<WidgetEvent> record, int limit) {
            return Math.min(changes, limit);
        }

        @Override
        public String applyBatch(PublishedRecord<WidgetEvent> record, String lastId, int batchSize) {
            return null;
        }

        @Override
        public Class<?> projectedClass() {
            return Object.class;
        }

        @Override
        public Class<Object> projectedViewClass() {
            return Object.class;
        }

        @Override
        public ReconciliationResult reconcile(List<Object> projectedItems) {
            return ReconciliationResult.allMatch();
        }
    }
}
