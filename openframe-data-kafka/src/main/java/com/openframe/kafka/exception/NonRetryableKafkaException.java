package com.openframe.kafka.exception;

public class NonRetryableKafkaException extends RuntimeException {
    public NonRetryableKafkaException(String msg, Throwable cause) { super(msg, cause); }
}
