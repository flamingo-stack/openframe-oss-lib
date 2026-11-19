package com.openframe.debezium.recovery;

import com.openframe.data.repository.connector.ConnectorRecreationEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecreationTrackerRecentTest {

    private static final String BASE = "shared-meshcentral-mongo-connector";

    @Mock private ConnectorRecreationEventRepository repository;

    @Test
    void hasRecentRecreation_mongoEventWithinWindow_true() {
        // setup
        MongoRecreationTracker tracker = new MongoRecreationTracker(repository, 3);
        when(repository.countByBaseNameAndCreatedAtAfter(eq(BASE), any(Instant.class))).thenReturn(1L);

        // execution
        boolean recent = tracker.hasRecentRecreation(BASE);

        // verifications
        assertThat(recent).isTrue();
    }

    @Test
    void hasRecentRecreation_mongoNoEventWithinWindow_false() {
        // setup
        MongoRecreationTracker tracker = new MongoRecreationTracker(repository, 3);
        when(repository.countByBaseNameAndCreatedAtAfter(eq(BASE), any(Instant.class))).thenReturn(0L);

        // execution
        boolean recent = tracker.hasRecentRecreation(BASE);

        // verifications
        assertThat(recent).isFalse();
    }

    @Test
    void hasRecentRecreation_inMemoryAfterRecord_true() {
        // setup
        InMemoryRecreationTracker tracker = new InMemoryRecreationTracker(3);
        tracker.record(BASE);

        // execution
        boolean recent = tracker.hasRecentRecreation(BASE);

        // verifications
        assertThat(recent).isTrue();
    }

    @Test
    void hasRecentRecreation_inMemoryNothingRecorded_false() {
        // setup
        InMemoryRecreationTracker tracker = new InMemoryRecreationTracker(3);

        // execution
        boolean recent = tracker.hasRecentRecreation(BASE);

        // verifications
        assertThat(recent).isFalse();
    }
}
