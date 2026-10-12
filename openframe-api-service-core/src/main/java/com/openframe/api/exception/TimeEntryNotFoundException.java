package com.openframe.api.exception;

public class TimeEntryNotFoundException extends RuntimeException {

    public TimeEntryNotFoundException(String id) {
        super("Time entry not found: " + id);
    }
}
