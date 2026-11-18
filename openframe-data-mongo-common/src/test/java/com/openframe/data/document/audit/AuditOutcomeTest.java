package com.openframe.data.document.audit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class AuditOutcomeTest {

    @Test
    void ofStatus_noStatus_isFailure() {
        assertThat(AuditOutcome.ofStatus(null)).isEqualTo(AuditOutcome.FAILURE);
    }

    @ParameterizedTest
    @ValueSource(ints = {408, 429})
    void ofStatus_timeoutOrRateLimit_isFailure(int status) {
        assertThat(AuditOutcome.ofStatus(status)).isEqualTo(AuditOutcome.FAILURE);
    }

    @ParameterizedTest
    @ValueSource(ints = {200, 399})
    void ofStatus_twoOrThreeHundreds_isSuccess(int status) {
        assertThat(AuditOutcome.ofStatus(status)).isEqualTo(AuditOutcome.SUCCESS);
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 499})
    void ofStatus_fourHundreds_isRefused(int status) {
        assertThat(AuditOutcome.ofStatus(status)).isEqualTo(AuditOutcome.REFUSED);
    }

    @Test
    void ofStatus_belowTwoHundred_isFailure() {
        assertThat(AuditOutcome.ofStatus(199)).isEqualTo(AuditOutcome.FAILURE);
    }

    @Test
    void ofStatus_fiveHundreds_isFailure() {
        assertThat(AuditOutcome.ofStatus(500)).isEqualTo(AuditOutcome.FAILURE);
    }
}
