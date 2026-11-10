package com.openframe.publishing.persistence;

import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.index.IndexDefinition;
import org.springframework.data.mongodb.core.index.IndexOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OutboxEventIndexTest {

    private final MongoOperations mongoOperations = mock(MongoOperations.class);
    private final IndexOperations indexOperations = mock(IndexOperations.class);

    @Test
    void startup_createsTheTtlIndex_soRowsExpireSevenDaysAfterTheyOccurred() {
        when(mongoOperations.indexOps(OutboxEvent.class)).thenReturn(indexOperations);
        OutboxIndexInitializer initializer = new OutboxIndexInitializer(mongoOperations);

        initializer.start();

        ArgumentCaptor<IndexDefinition> index = ArgumentCaptor.forClass(IndexDefinition.class);
        verify(indexOperations).createIndex(index.capture());
        long sevenDays = Duration.ofDays(7).toSeconds();
        assertThat(index.getValue().getIndexKeys()).isEqualTo(new Document("occurredAt", 1));
        assertThat(index.getValue().getIndexOptions())
                .containsEntry("name", "event_outbox_occurredAt_ttl")
                .containsEntry("expireAfterSeconds", sevenDays);
        assertThat(initializer.isRunning()).isTrue();
    }
}
