package com.openframe.api.service.rmm.script;

import com.openframe.api.config.ScriptExecutionProperties;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ScriptTimeoutValidator {

    private final ScriptExecutionProperties properties;

    public void validate(Integer timeoutSeconds) {
        if (timeoutSeconds == null) {
            return;
        }
        if (timeoutSeconds <= 0) {
            log.debug("Rejected script timeout {} (must be positive)", timeoutSeconds);
            throw new BadRequestException(ErrorCode.VALIDATION_ERROR, "timeoutSeconds must be a positive number of seconds");
        }
        int maxTimeoutSeconds = properties.getMaxTimeoutSeconds();
        if (timeoutSeconds > maxTimeoutSeconds) {
            log.debug("Rejected script timeout {} (exceeds max {})", timeoutSeconds, maxTimeoutSeconds);
            throw new BadRequestException(ErrorCode.VALIDATION_ERROR, "timeoutSeconds must not exceed " + maxTimeoutSeconds + " seconds");
        }
    }
}
