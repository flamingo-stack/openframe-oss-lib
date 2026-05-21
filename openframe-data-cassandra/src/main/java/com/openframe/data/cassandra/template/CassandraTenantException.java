package com.openframe.data.cassandra.template;

public class CassandraTenantException extends RuntimeException {

    public CassandraTenantException(String message) {
        super(message);
    }

    public CassandraTenantException(String message, Throwable cause) {
        super(message, cause);
    }
}
