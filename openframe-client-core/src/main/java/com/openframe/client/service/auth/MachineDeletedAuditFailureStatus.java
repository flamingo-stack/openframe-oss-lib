package com.openframe.client.service.auth;

import com.openframe.audit.AuditFailureStatus;
import com.openframe.client.exception.MachineDeletedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class MachineDeletedAuditFailureStatus implements AuditFailureStatus {

    @Override
    public Optional<HttpStatusCode> statusOf(Throwable failure) {
        return failure instanceof MachineDeletedException
                ? Optional.of(HttpStatus.GONE)
                : Optional.empty();
    }
}
