package com.openframe.data.cassandra.config;

/**
 * Unchecked exception thrown when Cassandra keyspace/table bootstrap
 * initialization fails during application startup.
 */
public class CassandraInitializationException extends RuntimeException {

    public CassandraInitializationException(String message, Throwable cause) {
        super(message, cause);
    }
}
