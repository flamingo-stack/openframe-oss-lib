package com.openframe.api.dto.rmm.software;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SoftwareActionIdTest {

    @Test
    void roundTripsAllThreeKeys() {
        SoftwareActionId decoded = SoftwareActionId.decode(
                SoftwareActionId.of("exec-1", "bundle-1", "sched-1").encode());
        assertThat(decoded.executionId()).isEqualTo("exec-1");
        assertThat(decoded.bundleId()).isEqualTo("bundle-1");
        assertThat(decoded.scheduleId()).isEqualTo("sched-1");
    }

    @Test
    void roundTripsWithMissingKeys() {
        SoftwareActionId decoded = SoftwareActionId.decode(
                SoftwareActionId.of("exec-1", null, "sched-1").encode());
        assertThat(decoded.executionId()).isEqualTo("exec-1");
        assertThat(decoded.bundleId()).isNull();
        assertThat(decoded.scheduleId()).isEqualTo("sched-1");
    }

    @Test
    void nonTokenValueIsTreatedAsBareExecutionId() {
        // A legacy raw executionId (not base64 of 3 parts) still resolves as the executionId.
        SoftwareActionId decoded = SoftwareActionId.decode("plain-execution-id");
        assertThat(decoded.executionId()).isEqualTo("plain-execution-id");
        assertThat(decoded.bundleId()).isNull();
        assertThat(decoded.scheduleId()).isNull();
    }

    @Test
    void blankIsEmpty() {
        assertThat(SoftwareActionId.decode(null).executionId()).isNull();
        assertThat(SoftwareActionId.decode("").executionId()).isNull();
    }
}
