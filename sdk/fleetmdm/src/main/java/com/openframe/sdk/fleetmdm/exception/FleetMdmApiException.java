package com.openframe.sdk.fleetmdm.exception;

public class FleetMdmApiException extends FleetMdmException {

    private final int statusCode;
    private final String responseBody;
    private final String reason;

    public FleetMdmApiException(String message, int statusCode, String responseBody) {
        this(message, statusCode, responseBody, null);
    }

    public FleetMdmApiException(String message, int statusCode, String responseBody, String reason) {
        super(message);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
        this.reason = reason;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getResponseBody() {
        return responseBody;
    }

    public String getReason() {
        return reason;
    }

    public String toString() {
        return "FleetMdmApiException(statusCode=" + this.getStatusCode() + ", responseBody=" + this.getResponseBody() + ")";
    }
}
