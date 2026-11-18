package com.openframe.audit;

import org.springframework.http.HttpStatusCode;

import java.util.Optional;

public interface AuditFailureStatus {

    Optional<HttpStatusCode> statusOf(Throwable failure);
}
