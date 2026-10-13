package com.openframe.debezium.service;

import com.openframe.debezium.dto.ConnectorOffsets;
import com.openframe.debezium.naming.VersionedConnectorNameStrategy;
import com.openframe.debezium.recovery.gap.GapRecoveryProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.never;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class DebeziumServiceGapRecoveryTest {

    private static final String BASE_URL = "http://connect:8083";
    private static final String BASE = "shared-meshcentral-mongo-connector";
    private static final String V1 = BASE + "_v1";
    private static final String V2 = BASE + "_v2";
    private static final String OFFSETS_JSON = """
            {"offsets":[{"partition":{"server_id":"shared.meshcentral"},"offset":{"sec":1791885584,"ord":16}}]}""";
    private static final String RUNNING_CONFIG_JSON = """
            {"name":"%s","connector.class":"io.debezium.connector.mongodb.MongoDbConnector","snapshot.mode":"no_data"}"""
            .formatted(V1);

    private MockRestServiceServer server;

    @AfterEach
    void tearDown() {
        server.verify();
    }

    @Test
    void createStoppedConnector_anyConfig_postedWithStoppedInitialState() {
        // setup
        DebeziumService service = service(gapProperties());
        server.expect(requestTo(BASE_URL + "/connectors"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.name").value(V2))
                .andExpect(jsonPath("$.initial_state").value("STOPPED"))
                .andExpect(jsonPath("$.config.name").value(V2))
                .andRespond(withStatus(HttpStatus.CREATED));

        // execution
        service.createStoppedConnector(V2, Map.of("connector.class", "x"));

        // verifications
        assertThat(server).isNotNull();
    }

    @Test
    void getConnectorOffsets_connectorExists_offsetsParsed() {
        // setup
        DebeziumService service = service(gapProperties());
        server.expect(requestTo(BASE_URL + "/connectors/" + V1 + "/offsets"))
                .andRespond(withSuccess(OFFSETS_JSON, MediaType.APPLICATION_JSON));

        // execution
        ConnectorOffsets offsets = service.getConnectorOffsets(V1);

        // verifications
        assertThat(offsets.sourceOffsets()).containsExactly(Map.of("sec", 1791885584, "ord", 16));
    }

    @Test
    void getConnectorOffsets_connectorMissing_empty() {
        // setup
        DebeziumService service = service(gapProperties());
        server.expect(requestTo(BASE_URL + "/connectors/" + V1 + "/offsets"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        // execution
        ConnectorOffsets offsets = service.getConnectorOffsets(V1);

        // verifications
        assertThat(offsets.isEmpty()).isTrue();
    }

    @Test
    void alterConnectorOffsets_offsetsGiven_patchedAsKafkaConnectBody() {
        // setup
        DebeziumService service = service(gapProperties());
        Map<String, Object> entry = Map.of("partition", Map.of("server_id", "shared.meshcentral"), "offset", Map.of("sec", 5));
        ConnectorOffsets offsets = new ConnectorOffsets(List.of(entry));
        server.expect(requestTo(BASE_URL + "/connectors/" + V2 + "/offsets"))
                .andExpect(method(HttpMethod.PATCH))
                .andExpect(content().json("{\"offsets\":[{\"partition\":{\"server_id\":\"shared.meshcentral\"},\"offset\":{\"sec\":5}}]}", true))
                .andRespond(withSuccess("{\"message\":\"altered\"}", MediaType.APPLICATION_JSON));

        // execution
        service.alterConnectorOffsets(V2, offsets);

        // verifications
        assertThat(server).isNotNull();
    }

    @Test
    void resumeConnector_anyConnector_putToResume() {
        // setup
        DebeziumService service = service(gapProperties());
        server.expect(requestTo(BASE_URL + "/connectors/" + V2 + "/resume"))
                .andExpect(method(HttpMethod.PUT))
                .andRespond(withStatus(HttpStatus.ACCEPTED));

        // execution
        service.resumeConnector(V2);

        // verifications
        assertThat(server).isNotNull();
    }

    @Test
    void createOrUpdate_onlySnapshotModeDiffersWithGapRecovery_noRecreation() {
        // setup
        DebeziumService service = service(gapProperties());
        expectRunningV1();
        server.expect(never(), requestTo(BASE_URL + "/connectors"));
        Object[] specs = specs(Map.of("connector.class", "io.debezium.connector.mongodb.MongoDbConnector", "snapshot.mode", "initial"));

        // execution
        service.createOrUpdateDebeziumConnector(specs);

        // verifications
        assertThat(service.isGapRecoveryEnabled()).isTrue();
    }

    @Test
    void createOrUpdate_onlySnapshotModeDiffersWithoutGapRecovery_recreatedAsSpecified() {
        // setup
        DebeziumService service = service(null);
        expectRunningV1();
        server.expect(requestTo(BASE_URL + "/connectors"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.name").value(V2))
                .andExpect(jsonPath("$.config['snapshot.mode']").value("initial"))
                .andRespond(withStatus(HttpStatus.CREATED));
        server.expect(requestTo(BASE_URL + "/connectors/" + V1)).andExpect(method(HttpMethod.DELETE))
                .andRespond(withStatus(HttpStatus.NO_CONTENT));
        Object[] specs = specs(Map.of("connector.class", "io.debezium.connector.mongodb.MongoDbConnector", "snapshot.mode", "initial"));

        // execution
        service.createOrUpdateDebeziumConnector(specs);

        // verifications
        assertThat(service.isGapRecoveryEnabled()).isFalse();
    }

    @Test
    void createOrUpdate_realDriftWithGapRecovery_recreatedWithoutInitialSnapshot() {
        // setup
        DebeziumService service = service(gapProperties());
        expectRunningV1();
        server.expect(requestTo(BASE_URL + "/connectors"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.name").value(V2))
                .andExpect(jsonPath("$.config['snapshot.mode']").value("no_data"))
                .andExpect(jsonPath("$.config['skipped.operations']").value("d,t"))
                .andRespond(withStatus(HttpStatus.CREATED));
        server.expect(requestTo(BASE_URL + "/connectors/" + V1)).andExpect(method(HttpMethod.DELETE))
                .andRespond(withStatus(HttpStatus.NO_CONTENT));
        Object[] specs = specs(Map.of(
                "connector.class", "io.debezium.connector.mongodb.MongoDbConnector",
                "snapshot.mode", "initial",
                "skipped.operations", "d,t"));

        // execution
        service.createOrUpdateDebeziumConnector(specs);

        // verifications
        assertThat(service.isGapRecoveryEnabled()).isTrue();
    }

    private DebeziumService service(GapRecoveryProperties properties) {
        DebeziumService service = new DebeziumService(new VersionedConnectorNameStrategy(), null, properties);
        ReflectionTestUtils.setField(service, "debeziumUrl", BASE_URL);
        ReflectionTestUtils.setField(service, "connectTimeout", Duration.ofSeconds(1));
        ReflectionTestUtils.setField(service, "readTimeout", Duration.ofSeconds(1));
        service.init();
        RestTemplate restTemplate = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        server = MockRestServiceServer.bindTo(restTemplate).build();
        return service;
    }

    private void expectRunningV1() {
        server.expect(requestTo(BASE_URL + "/connectors"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("[\"" + V1 + "\"]", MediaType.APPLICATION_JSON));
        server.expect(requestTo(BASE_URL + "/connectors/" + V1 + "/config"))
                .andRespond(withSuccess(RUNNING_CONFIG_JSON, MediaType.APPLICATION_JSON));
    }

    private static Object[] specs(Map<String, Object> config) {
        return new Object[]{Map.of("name", BASE, "config", config)};
    }

    private static GapRecoveryProperties gapProperties() {
        return new GapRecoveryProperties();
    }
}
