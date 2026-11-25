package com.openframe.client.service.auth;

import com.openframe.client.exception.MachineDeletedException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

class MachineDeletedAuditFailureStatusTest {

    private final MachineDeletedAuditFailureStatus failureStatus = new MachineDeletedAuditFailureStatus();

    @Test
    void statusOf_deletedMachine_answersGone() {
        assertThat(failureStatus.statusOf(new MachineDeletedException("Machine is deleted"))).contains(HttpStatus.GONE);
    }

    @Test
    void statusOf_anotherFailure_answersNothing() {
        assertThat(failureStatus.statusOf(new IllegalStateException("Machine is deleted"))).isEmpty();
    }
}
