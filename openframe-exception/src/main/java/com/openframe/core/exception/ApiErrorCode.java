package com.openframe.core.exception;

// What the REST and GraphQL error handlers read from a code. A library outside this one declares its own codes
// by implementing it.
public interface ApiErrorCode {

    String getCode();

    int getHttpStatus();
}
