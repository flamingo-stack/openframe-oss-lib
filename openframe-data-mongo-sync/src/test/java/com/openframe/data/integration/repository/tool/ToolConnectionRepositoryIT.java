package com.openframe.data.integration.repository.tool;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class ToolConnectionRepositoryIT extends BaseMongoIntegrationTest {

    private static MongoClient client;
    private static MongoTemplate template;
    private static ToolConnectionRepository repository;

    @BeforeAll
    static void setUp() {
        String uri = System.getProperty("mongo.external.uri");
        if (uri == null) {
            if (!MONGO.isRunning()) {
                MONGO.start();
            }
            uri = MONGO.getConnectionString() + "/?directConnection=true";
        }
        client = MongoClients.create(uri);
        template = new MongoTemplate(client, "test");
        MongoRepositoryFactory factory = new MongoRepositoryFactory(template);
        repository = factory.getRepository(ToolConnectionRepository.class);
    }

    @AfterAll
    static void tearDown() {
        client.close();
    }

    @BeforeEach
    void clean() {
        template.dropCollection(ToolConnection.class);
    }

    @Test
    void findByTenantIdAndMachineIdInAndToolTypeAndStatus_onlyTheGivenMachinesConnectedFleetRowsOfTheTenant() {
        // setup
        save("tenant-1", "m-1", ToolType.FLEET_MDM, ConnectionStatus.CONNECTED);
        save("tenant-1", "m-2", ToolType.FLEET_MDM, ConnectionStatus.DISCONNECTED);
        save("tenant-1", "m-3", ToolType.MESHCENTRAL, ConnectionStatus.CONNECTED);
        save("tenant-1", "m-4", ToolType.FLEET_MDM, ConnectionStatus.CONNECTED);
        save("tenant-2", "m-1", ToolType.FLEET_MDM, ConnectionStatus.CONNECTED);

        // execution
        List<ToolConnection> connections = repository.findByTenantIdAndMachineIdInAndToolTypeAndStatus(
                "tenant-1", List.of("m-1", "m-2", "m-3"), ToolType.FLEET_MDM, ConnectionStatus.CONNECTED);

        // verifications
        assertThat(connections).extracting(ToolConnection::getTenantId, ToolConnection::getMachineId)
                .containsExactly(tuple("tenant-1", "m-1"));
    }

    private ToolConnection save(String tenantId, String machineId, ToolType toolType, ConnectionStatus status) {
        ToolConnection connection = new ToolConnection();
        connection.setTenantId(tenantId);
        connection.setMachineId(machineId);
        connection.setToolType(toolType);
        connection.setStatus(status);
        connection.setAgentToolId("42");
        return template.save(connection);
    }
}
