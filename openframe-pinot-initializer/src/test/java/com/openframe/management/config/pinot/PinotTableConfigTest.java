package com.openframe.management.config.pinot;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Erasure of a deleted tenant (CU-17tkuw62cvq) relies on compaction removing every superseded row: a threshold
 * of one invalid record and IN_MEMORY valid doc ids on logs (no snapshots there). Replicas must agree on valid docs
 * (Pinot 1.6+). No task cap: the single minion runs one task at a time, and a cap would shrink the nightly run.
 * Only task config changes: the controller reads it, so no Pinot server restart. The upsert config must stay.
 */
class PinotTableConfigTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String COMPACTION = "UpsertCompactionTask";

    @Test
    void devicesCompactionThresholdIsOne() throws IOException {
        JsonNode table = read("table-config-devices.json");
        JsonNode task = table.path("task").path("taskTypeConfigsMap").path(COMPACTION);

        assertThat(task.path("invalidRecordsThresholdCount").asString()).isEqualTo("1");
        assertThat(task.path("invalidRecordsThresholdPercent").asString()).isEqualTo("0");
        assertThat(task.path("schedule").asString()).isEqualTo("0 0 3 * * ?");
        assertThat(task.path("bufferTimePeriod").asString()).isEqualTo("4h");
        assertReplicaConsensusWithoutCap(task);
        assertThat(table.path("upsertConfig").has("deleteRecordColumn")).isFalse();
        assertThat(table.path("upsertConfig").path("snapshot").asString()).isEqualTo("ENABLE");
    }

    @Test
    void logsHasUnscheduledInMemoryCompaction() throws IOException {
        JsonNode table = read("table-config-logs-realtime.json");
        JsonNode task = table.path("task").path("taskTypeConfigsMap").path(COMPACTION);

        assertThat(task.isObject()).isTrue();
        assertThat(task.has("schedule")).isFalse();
        assertThat(task.path("validDocIdsType").asString()).isEqualTo("IN_MEMORY");
        assertThat(task.path("invalidRecordsThresholdCount").asString()).isEqualTo("1");
        assertThat(task.path("invalidRecordsThresholdPercent").asString()).isEqualTo("0");
        assertThat(task.path("bufferTimePeriod").asString()).isEqualTo("4h");
        assertReplicaConsensusWithoutCap(task);
        assertThat(table.path("upsertConfig").has("deleteRecordColumn")).isFalse();
        assertThat(table.path("upsertConfig").has("snapshot")).isFalse();
    }

    private static void assertReplicaConsensusWithoutCap(JsonNode task) {
        assertThat(task.has("tableMaxNumTasks")).isFalse();
        assertThat(task.path("validDocIdsConsensusMode").asString()).isEqualTo("EQUAL");
        assertThat(task.path("validDocIdsValidationMode").asString()).isEqualTo("STRICT");
    }

    private static JsonNode read(String file) throws IOException {
        try (InputStream in = new ClassPathResource("pinot/config/" + file).getInputStream()) {
            return JSON.readTree(in);
        }
    }
}
