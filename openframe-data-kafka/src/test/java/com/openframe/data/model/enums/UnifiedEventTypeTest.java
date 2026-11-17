package com.openframe.data.model.enums;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

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

    @ParameterizedTest
    @CsvSource({
            "REMOTE_CLIPBOARD_COPIED, Clipboard copied from the remote device",
            "REMOTE_CLIPBOARD_PASTED, Clipboard pasted to the remote device"
    })
    void clipboardTypes_infoWithTheirSummaries(UnifiedEventType type, String expectedSummary) {
        // execution
        Severity severity = type.getSeverity();
        String summary = type.getSummary();

        // verifications
        assertThat(severity).isEqualTo(Severity.INFO);
        assertThat(summary).isEqualTo(expectedSummary);
    }

    @ParameterizedTest
    @CsvSource({
            "IDENTITY_PROFILE_CREATED, Profile created",
            "IDENTITY_ACCOUNT_LINKED, Account linked",
            "IDENTITY_ACCOUNT_UNLINKED, Account unlinked"
    })
    void identityEventTypes_allInfoSeverityWithTheirSummaries(String name, String expectedSummary) {
        // setup
        UnifiedEventType type = UnifiedEventType.valueOf(name);

        // execution
        Severity severity = type.getSeverity();
        String summary = type.getSummary();

        // verifications
        assertThat(severity).isEqualTo(Severity.INFO);
        assertThat(summary).isEqualTo(expectedSummary);
    }
}
