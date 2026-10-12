package com.openframe.data.cassandra.model.enums;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UnifiedEventTypeTest {

    @Test
    void remoteSessionDeleted_isAnInfoEventWithItsSummary() {
        // setup
        UnifiedEventType type = UnifiedEventType.REMOTE_SESSION_DELETED;

        // execution
        Severity severity = type.getSeverity();
        String summary = type.getSummary();

        // verifications
        assertThat(severity).isEqualTo(Severity.INFO);
        assertThat(summary).isEqualTo("Remote session deleted");
    }
}
