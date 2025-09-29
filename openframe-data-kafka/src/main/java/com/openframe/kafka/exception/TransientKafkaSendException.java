package com.openframe.kafka.exception;

public class TransientKafkaSendException extends RuntimeException {
    public TransientKafkaSendException(String msg, Throwable cause) { super(msg, cause); }
}
