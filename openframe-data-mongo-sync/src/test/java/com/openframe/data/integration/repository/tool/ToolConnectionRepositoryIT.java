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
import org.springframework.data.domain.Limit;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class ToolConnectionRepositoryIT extends BaseMongoIntegrationTest {

    private static final String BEFORE_FIRST = "000000000000000000000000";

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
    void findByToolTypeAndStatusAndIdGreaterThan_connectedFleetRows_pagedInIdOrderAfterTheCursor() {
        // setup
        save("m-1", ToolType.FLEET_MDM, ConnectionStatus.CONNECTED);
        save("m-2", ToolType.FLEET_MDM, ConnectionStatus.CONNECTED);
        save("m-3", ToolType.FLEET_MDM, ConnectionStatus.CONNECTED);
        save("m-4", ToolType.FLEET_MDM, ConnectionStatus.DISCONNECTED);
        save("m-5", ToolType.MESHCENTRAL, ConnectionStatus.CONNECTED);
        Limit two = Limit.of(2);

        // execution
        List<ToolConnection> firstPage = repository.findByToolTypeAndStatusAndIdGreaterThanOrderByIdAsc(
                ToolType.FLEET_MDM, ConnectionStatus.CONNECTED, BEFORE_FIRST, two);
        String cursor = firstPage.getLast().getId();
        List<ToolConnection> nextPage = repository.findByToolTypeAndStatusAndIdGreaterThanOrderByIdAsc(
                ToolType.FLEET_MDM, ConnectionStatus.CONNECTED, cursor, two);

        // verifications
        assertThat(firstPage).extracting(ToolConnection::getMachineId).containsExactly("m-1", "m-2");
        assertThat(nextPage).extracting(ToolConnection::getMachineId).containsExactly("m-3");
    }

    @Test
    void findByToolTypeAndStatusAndIdGreaterThan_cursorAtTheLastRow_empty() {
        // setup
        ToolConnection last = save("m-1", ToolType.FLEET_MDM, ConnectionStatus.CONNECTED);

        // execution
        List<ToolConnection> page = repository.findByToolTypeAndStatusAndIdGreaterThanOrderByIdAsc(
                ToolType.FLEET_MDM, ConnectionStatus.CONNECTED, last.getId(), Limit.of(200));

        // verifications
        assertThat(page).isEmpty();
    }

    private ToolConnection save(String machineId, ToolType toolType, ConnectionStatus status) {
        ToolConnection connection = new ToolConnection();
        connection.setTenantId("tenant-1");
        connection.setMachineId(machineId);
        connection.setToolType(toolType);
        connection.setStatus(status);
        connection.setAgentToolId("42");
        return template.save(connection);
    }
}
