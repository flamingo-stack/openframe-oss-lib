package com.openframe.core.exception;

import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * Thrown when an artifact (script, osquery policy/query) fails the mandatory
 * validation gate. The message lists every specific failure so API clients
 * and the AI agent can correct the artifact and retry instead of saving it.
 */
public class ArtifactValidationException extends BaseException {

    public ArtifactValidationException(List<String> errors) {
        super(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST,
                "Artifact validation failed: " + String.join("; ", errors));
    }
}
