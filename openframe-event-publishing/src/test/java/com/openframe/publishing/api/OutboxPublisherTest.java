package com.openframe.publishing.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.mongodb.client.result.DeleteResult;
import com.openframe.publishing.config.PublishedAggregateTopics;
import com.openframe.publishing.fixture.Widgets.Widget;
import com.openframe.publishing.fixture.Widgets.WidgetSpec;
import com.openframe.publishing.persistence.OutboxEvent;
import com.openframe.publishing.transaction.MongoTransactionRunner;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.NoOpDbRefResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.data.mongodb.core.query.Query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OutboxPublisherTest {

    private static final PublishedAggregateType WIDGETS = PublishedAggregateType.ORGANIZATIONS;

    @Mock private PublishedAggregateTopics topics;
    @Mock private MongoOperations mongoOperations;
    @Mock private MongoTransactionRunner runner;
    @Mock private ObjectProvider<MongoTransactionRunner> runnerProvider;
    @Captor private ArgumentCaptor<Collection<OutboxEvent>> rows;

    private final WidgetSpec spec = new WidgetSpec();
    private OutboxPublisher publisher;

    @BeforeEach
    void setUp() throws Throwable {
        MappingMongoConverter converter = new MappingMongoConverter(NoOpDbRefResolver.INSTANCE, new MongoMappingContext());
        lenient().when(mongoOperations.getConverter()).thenReturn(converter);
        lenient().when(runnerProvider.getObject()).thenReturn(runner);
        lenient().when(runner.run(any())).thenAnswer(invocation ->
                invocation.<MongoTransactionRunner.Transaction<Object>>getArgument(0).execute());
        lenient().when(topics.isPublishing(WIDGETS)).thenReturn(true);
        publisher = new OutboxPublisher(topics, mongoOperations, runnerProvider);
    }

    @Test
    void aChangedDocument_writesARowWithItsIdTenantVersionAndType() {
        Widget saved = widget("w-1", 2L);

        Widget result = publisher.publishChanged(spec, () -> saved);

        assertThat(result).isSameAs(saved);
        verify(mongoOperations).insert(rows.capture(), eq(OutboxEvent.class));
        assertThat(onlyRow().getAggregateType()).isEqualTo("organizations");
        assertThat(onlyRow().getAggregateId()).isEqualTo("w-1");
        assertThat(onlyRow().getTenantId()).isEqualTo("tenant-1");
        assertThat(onlyRow().getVersion()).isEqualTo(2L);
        assertThat(onlyRow().isDeleted()).isFalse();
        assertThat(onlyRow().getSchemaVersion()).isEqualTo(1);
        assertThat(onlyRow().getOccurredAt()).isNotNull();
    }

    @Test
    void thePayloadIsTheEventAsJson_withJacksonNamesAndIsoDates() {
        publisher.publishChanged(new SampleSpec(), () -> widget("w-1", 0L));

        verify(mongoOperations).insert(rows.capture(), eq(OutboxEvent.class));
        assertThat(onlyRow().getPayload())
                .containsEntry("name", "Acme")
                .containsEntry("isDefault", true)
                .containsEntry("status", "ARCHIVED")
                .containsEntry("changedAt", "2026-10-20T10:15:30Z")
                .containsEntry("revenue", new BigDecimal("12.50"))
                .doesNotContainKey("_class");
    }

    @Test
    void severalChangedDocuments_andAnOptional_writeOneRowEach() {
        publisher.publishChanged(spec, () -> List.of(widget("w-1", 0L), widget("w-2", 0L)));
        publisher.publishChanged(spec, () -> Optional.of(widget("w-3", 0L)));
        publisher.publishChanged(spec, Optional::empty);

        verify(mongoOperations, times(2)).insert(rows.capture(), eq(OutboxEvent.class));
        assertThat(rows.getAllValues()).flatExtracting(batch -> batch).hasSize(3);
    }

    @Test
    void aDeletedDocument_writesADeletedRowOneAboveItsVersion() {
        publisher.publishDeleted(spec, () -> widget("w-1", 4L));

        verify(mongoOperations).insert(rows.capture(), eq(OutboxEvent.class));
        assertThat(onlyRow().isDeleted()).isTrue();
        assertThat(onlyRow().getVersion()).isEqualTo(5L);
        assertThat(onlyRow().getPayload()).isNull();
    }

    @Test
    void aDeleteByIds_readsOnlyTheTombstoneFields_beforeTheWrite() {
        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        when(mongoOperations.find(query.capture(), eq(Widget.class))).thenReturn(List.of(widget("w-1", 3L)));
        Runnable write = mock(Runnable.class);

        publisher.publishDeletedByIds(spec, List.of("w-1"), () -> {
            write.run();
            return null;
        });

        assertThat(query.getValue().getFieldsObject()).containsOnlyKeys("_id", "version", "tenantId");
        InOrder order = inOrder(mongoOperations, write);
        order.verify(mongoOperations).find(any(Query.class), eq(Widget.class));
        order.verify(write).run();
        order.verify(mongoOperations).insert(rows.capture(), eq(OutboxEvent.class));
        assertThat(onlyRow().getVersion()).isEqualTo(4L);
        assertThat(onlyRow().isDeleted()).isTrue();
    }

    @Test
    @SuppressWarnings("unchecked")
    void storedDocuments_areReadBeforeTheWrite() {
        Runnable write = mock(Runnable.class);
        Supplier<List<Widget>> stored = mock(Supplier.class);
        when(stored.get()).thenReturn(List.of(widget("w-1", 0L)));

        publisher.publishDeleted(spec, stored, () -> {
            write.run();
            return null;
        });

        InOrder order = inOrder(stored, write, mongoOperations);
        order.verify(stored).get();
        order.verify(write).run();
        order.verify(mongoOperations).insert(anyCollection(), eq(OutboxEvent.class));
    }

    @Test
    void documentsNamedByIds_areReadAfterTheWrite() {
        when(mongoOperations.find(any(Query.class), eq(Widget.class))).thenReturn(List.of(widget("w-1", 1L)));

        long modified = publisher.publishChangedByIds(spec, List.of("w-1"), () -> 1L);

        assertThat(modified).isEqualTo(1L);
        verify(mongoOperations).insert(rows.capture(), eq(OutboxEvent.class));
        assertThat(onlyRow().getVersion()).isEqualTo(1L);
    }

    @Test
    void publishOff_onlyRunsTheWrite() {
        when(topics.isPublishing(WIDGETS)).thenReturn(false);

        Widget result = publisher.publishChanged(spec, () -> widget("w-1", 0L));

        assertThat(result.getId()).isEqualTo("w-1");
        verifyNoInteractions(runner);
        verify(mongoOperations, never()).insert(anyCollection(), any(Class.class));
        verify(mongoOperations, never()).find(any(Query.class), any());
    }

    @Test
    void deleteAllWithPublishOff_isOneScopedRemove_withNoRead() {
        when(topics.isPublishing(WIDGETS)).thenReturn(false);
        DeleteResult removed = DeleteResult.acknowledged(1);
        when(mongoOperations.remove(any(Query.class), eq(Widget.class))).thenReturn(removed);

        publisher.publishDeletedAll(spec);

        verify(mongoOperations).remove(any(Query.class), eq(Widget.class));
        verify(mongoOperations, never()).find(any(Query.class), any());
        verifyNoInteractions(runner);
    }

    @Test
    void deleteAll_removesTheIdsItRead_inChunksOfAThousand_andWritesATombstoneForEach() {
        List<Widget> stored = IntStream.range(0, 1_001)
                .mapToObj(index -> widget("w-" + index, 0L))
                .toList();
        when(mongoOperations.find(any(Query.class), eq(Widget.class))).thenAnswer(invocation -> stored);
        DeleteResult removed = DeleteResult.acknowledged(1_000);
        when(mongoOperations.remove(any(Query.class), eq(Widget.class))).thenReturn(removed);

        publisher.publishDeletedAll(spec);

        verify(mongoOperations, times(2)).remove(any(Query.class), eq(Widget.class));
        verify(mongoOperations).insert(rows.capture(), eq(OutboxEvent.class));
        assertThat(rows.getValue()).hasSize(1_001).allSatisfy(row -> assertThat(row.isDeleted()).isTrue());
    }

    private OutboxEvent onlyRow() {
        Collection<OutboxEvent> written = rows.getValue();
        assertThat(written).hasSize(1);
        return written.iterator().next();
    }

    private static Widget widget(String id, Long version) {
        return new Widget(id, "tenant-1", "Printer", null, version);
    }

    enum Status { ARCHIVED }

    @Getter
    @AllArgsConstructor
    static class SampleEvent implements PublishedEvent {
        private final String name;
        @JsonProperty("isDefault")
        private final boolean isDefault;
        private final Status status;
        private final Instant changedAt;
        private final BigDecimal revenue;
    }

    static class SampleSpec implements PublishedAggregateSpec<Widget, SampleEvent> {
        @Override
        public PublishedAggregateType getType() {
            return WIDGETS;
        }

        @Override
        public SampleEvent toEvent(Widget document) {
            Instant changedAt = Instant.parse("2026-10-20T10:15:30Z");
            return new SampleEvent("Acme", true, Status.ARCHIVED, changedAt, new BigDecimal("12.50"));
        }
    }
}
