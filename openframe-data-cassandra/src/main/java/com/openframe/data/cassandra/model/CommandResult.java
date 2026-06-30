package com.openframe.data.cassandra.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyClass;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;
import org.springframework.data.cassandra.core.mapping.Table;

/**
 * One machine's result for a batch command execution.
 */
@Table("command_results")
@Data
public class CommandResult {

    @PrimaryKey
    private CommandResultKey key;

    /**
     * The agent's full command-execution result as a single JSON string.
     */
    @Column("result")
    private String result;

    @PrimaryKeyClass
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CommandResultKey {

        @PrimaryKeyColumn(name = "execution_id", ordinal = 0, type = PrimaryKeyType.PARTITIONED)
        private String executionId;

        @PrimaryKeyColumn(name = "machine_id", ordinal = 1, type = PrimaryKeyType.CLUSTERED)
        private String machineId;
    }
}
