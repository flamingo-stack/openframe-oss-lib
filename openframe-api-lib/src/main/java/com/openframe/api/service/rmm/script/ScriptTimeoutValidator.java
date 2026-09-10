package com.openframe.api.service.rmm.script;

import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class ScriptTimeoutValidator {

    @Value("${openframe.rmm.script.max-timeout-seconds:600}")
    private int maxTimeoutSeconds;

    public void validate(Integer timeoutSeconds) {
        if (timeoutSeconds == null) {
            return;
        }
        if (timeoutSeconds <= 0) {
            log.debug("Rejected script timeout {} (must be positive)", timeoutSeconds);
            throw new BadRequestException(ErrorCode.VALIDATION_ERROR, "timeoutSeconds must be a positive number of seconds");
        }
        if (timeoutSeconds > maxTimeoutSeconds) {
            log.debug("Rejected script timeout {} (exceeds max {})", timeoutSeconds, maxTimeoutSeconds);
            throw new BadRequestException(ErrorCode.VALIDATION_ERROR, "timeoutSeconds must not exceed " + maxTimeoutSeconds + " seconds");
        }
    }
}
