package com.openframe.client.exception;

public class MalformedDeviceOsReportException extends RuntimeException {

    public MalformedDeviceOsReportException(String message) {
        super(message);
    }

    public MalformedDeviceOsReportException(String message, Throwable cause) {
        super(message, cause);
    }
}
