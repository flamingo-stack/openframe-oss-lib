package com.openframe.data.model.enums;

public enum Destination {

    KAFKA_PINOT,
    CASSANDRA_EVENT_LOG,
    LOKI_EVENT_LOG,
    CASSANDRA_COMMAND_RESULT,
    MONGO_HISTORY,
    MONGO_COMMAND_HISTORY,
    TENANT_REMOTE_SESSION_EVENT

}
