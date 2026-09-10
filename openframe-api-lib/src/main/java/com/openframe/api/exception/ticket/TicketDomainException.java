package com.openframe.api.exception.ticket;

import com.openframe.core.exception.BaseException;
import com.openframe.core.exception.ErrorCode;
import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.Collections;
import java.util.Map;

/**
 * Base class of the ticket domain errors. Extends {@link BaseException} so REST entry points get
 * the code/status mapping from {@code BaseGlobalExceptionHandler} for free; the GraphQL layer adds
 * {@link #getExtensions()} to the error payload.
 */
@Getter
public abstract class TicketDomainException extends BaseException {

    private final Map<String, Object> extensions;

    protected TicketDomainException(ErrorCode errorCode, HttpStatus httpStatus, String message) {
        this(errorCode, httpStatus, message, Collections.emptyMap());
    }

    protected TicketDomainException(ErrorCode errorCode,
                                    HttpStatus httpStatus,
                                    String message,
                                    Map<String, Object> extensions) {
        super(errorCode, httpStatus, message);
        this.extensions = extensions == null ? Collections.emptyMap() : Map.copyOf(extensions);
    }
}
