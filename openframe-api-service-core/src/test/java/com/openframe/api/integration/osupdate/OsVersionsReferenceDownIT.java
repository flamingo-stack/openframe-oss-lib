package com.openframe.api.integration.osupdate;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.DeviceOsReadTestApplication;
import graphql.ExecutionResult;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.Map;

import static com.openframe.api.integration.osupdate.OsVersionsReadIT.machine;
import static com.openframe.api.integration.osupdate.OsVersionsReadIT.map;
import static com.openframe.api.integration.osupdate.OsVersionsReadIT.page;
import static com.openframe.api.integration.osupdate.OsVersionsReadIT.state;
import static com.openframe.api.integration.support.DeviceOsReadTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

// Port 9 (discard) refuses the connection: the source is down.
@SpringBootTest(
        classes = DeviceOsReadTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "openframe.rmm.os-update.enabled=true",
                "openframe.rmm.os-update.os-versions.enabled=true",
                "openframe.rmm.os-update.os-versions.endoflife.base-url=http://127.0.0.1:9",
                "openframe.rmm.os-update.os-versions.endoflife.timeout=2s",
                "openframe.tenant-isolation.enabled=true"
        })
@Import(OsVersionsReferenceDownIT.Metrics.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OsVersionsReferenceDownIT extends BaseMongoIntegrationTest {

    private static final String MACHINE = "os-versions-down-w11";
    private static final String SOURCE_FAILED = "openframe.rmm.os_update.os_versions.source_failed";

    @TestConfiguration
    static class Metrics {
        @Bean
        MeterRegistry meterRegistry() {
            return new SimpleMeterRegistry();
        }
    }

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MeterRegistry meterRegistry;

    @BeforeEach
    void storeOneDevice() {
        mongoTemplate.getCollection("machines").deleteMany(new Document("machineId", MACHINE));
        mongoTemplate.getCollection("device_os_states").deleteMany(new Document());
        mongoTemplate.getCollection("os_version_builds").deleteMany(new Document());
        mongoTemplate.getCollection("machines").insertOne(machine(MACHINE, TENANT_ID, "org-a", "ONLINE"));
        mongoTemplate.getCollection("device_os_states").insertOne(
                state(MACHINE, TENANT_ID, "WINDOWS", "11 24H2", "26100.4061", "Windows 11 Pro"));
    }

    @Test
    void osVersionsAndDevices_sourceDown_countsWithoutReferenceAndTheFailureCountedOnce() {
        // setup
        double failedBefore = failed();

        // execution
        ExecutionResult versions = queryExecutor.execute("""
                { osVersions { edges { node {
                  osVersion deviceCount devicesBehindCount currentBuild endOfSupportAt supportEnded } }
                  pageInfo { hasNextPage hasPreviousPage endCursor } } }
                """);
        ExecutionResult devices = queryExecutor.execute("""
                { osVersionDevices(osVersion: "11 24H2") { edges { node { machineId osBuild upToDate } }
                  pageInfo { hasNextPage hasPreviousPage endCursor } } }
                """);

        // verifications
        assertThat(versions.getErrors()).isEmpty();
        assertThat(OsVersionsReadIT.page(map(versions.<Map<String, Object>>getData()).get("osVersions")).nodes())
                .extracting(node -> node.get("osVersion"), node -> node.get("deviceCount"),
                        node -> node.get("devicesBehindCount"), node -> node.get("currentBuild"),
                        node -> node.get("endOfSupportAt"), node -> node.get("supportEnded"))
                .containsExactly(tuple("11 24H2", 1, null, null, null, null));
        assertThat(devices.getErrors()).isEmpty();
        assertThat(page(map(devices.<Map<String, Object>>getData()).get("osVersionDevices")).nodes())
                .extracting(node -> node.get("machineId"), node -> node.get("osBuild"), node -> node.get("upToDate"))
                .containsExactly(tuple(MACHINE, "26100.4061", null));
        assertThat(failed() - failedBefore).isEqualTo(1.0);
    }

    private double failed() {
        return meterRegistry.counter(SOURCE_FAILED, "source", "endoflife").count();
    }
}
