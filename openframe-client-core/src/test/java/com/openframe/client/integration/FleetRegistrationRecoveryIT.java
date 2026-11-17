package com.openframe.client.integration;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.openframe.client.listener.ToolConnectionListener;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.ToolConnectionService;
import com.openframe.client.service.DeviceLifecycleService;
import com.openframe.client.event.DeviceFirstConnectedEvent;
import com.openframe.client.service.agentregistration.fleet.FleetHostFactsWriter;
import com.openframe.client.service.agentregistration.fleet.FleetMdmClients;
import com.openframe.client.service.agentregistration.transformer.FleetMdmAgentIdTransformer;
import com.openframe.client.service.agentregistration.transformer.ToolAgentIdTransformerService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.config.ClientVersionThreshold;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.data.service.machine.MachineWriter;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.nats.client.Connection;
import io.nats.client.Message;
import io.nats.client.impl.NatsJetStreamMetaData;
import org.bson.Document;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import org.springframework.data.repository.core.support.RepositoryComposition.RepositoryFragments;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Tag("integration")
@Execution(ExecutionMode.CONCURRENT)
@Slf4j
class FleetRegistrationRecoveryIT {

    private static final String RAW_ID = "5c0b4a3e-1f2d-4e6a-9b8c-7d6e5f4a3b2c";
    private static final Instant OLD_CONNECTION = Instant.parse("2026-01-01T00:00:00Z");
    private static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));
    private static final java.util.Set<String> THREADS = ConcurrentHashMap.newKeySet();
    private static final AtomicInteger ACTIVE_CASES = new AtomicInteger();
    private static final AtomicInteger MAX_ACTIVE_CASES = new AtomicInteger();

    private MongoClient mongo;
    private MongoTemplate template;
    private ToolConnectionRepository connections;
    private ToolConnectionService service;
    private ApplicationEventPublisher events;
    private HttpServer fleet;
    private String machineId;
    private String database;
    private final AtomicReference<String> fleetMode = new AtomicReference<>("missing");
    private final AtomicReference<Long> fleetHostId = new AtomicReference<>(42L);
    private final AtomicReference<Runnable> duringLookup = new AtomicReference<>();
    private final AtomicInteger fleetRequests = new AtomicInteger();

    @BeforeAll
    static void startInfrastructure() {
        if (System.getProperty("mongo.external.uri") == null) {
            MONGO.start();
        }
    }

    @AfterAll
    static void stopInfrastructure() {
        MONGO.stop();
        if (Boolean.getBoolean("fleet.registration.requireParallel")) {
            assertThat(THREADS).hasSizeGreaterThanOrEqualTo(2);
            assertThat(MAX_ACTIVE_CASES.get()).isGreaterThanOrEqualTo(2);
        }
        log.info("Fleet recovery parallel execution: maxActive={}, threads={}", MAX_ACTIVE_CASES.get(), THREADS);
    }

    @BeforeEach
    void setUp() throws Exception {
        database = "fleet_registration_" + UUID.randomUUID().toString().replace("-", "");
        machineId = UUID.randomUUID().toString();
        String uri = System.getProperty("mongo.external.uri");
        mongo = MongoClients.create(uri == null ? MONGO.getConnectionString() : uri);
        SimpleMongoClientDatabaseFactory databaseFactory = new SimpleMongoClientDatabaseFactory(mongo, database);
        MongoTemplate unscoped = new MongoTemplate(databaseFactory);
        template = new TenantAwareMongoTemplate(databaseFactory, unscoped.getConverter(), () -> "synthetic-tenant");
        MongoRepositoryFactory repositories = new MongoRepositoryFactory(template);
        connections = repositories.getRepository(ToolConnectionRepository.class);
        template.indexOps(ToolConnection.class).ensureIndex(new Index()
                .on("tenantId", Sort.Direction.ASC).on("machineId", Sort.Direction.ASC).on("toolType", Sort.Direction.ASC)
                .unique().named("tenant_machine_tool_idx"));
        MachineRepository machines = repositories.getRepository(MachineRepository.class,
                RepositoryFragments.just(new CustomMachineRepositoryImpl(template, new ClientVersionThreshold("1.6.0"))));
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setTenantId("synthetic-tenant");
        machine.setStatus(DeviceStatus.PENDING);
        machines.save(machine);
        fleet = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        fleet.createContext("/api/v1/fleet/hosts", this::respondToFleetLookup);
        fleet.start();
        String fleetUrl = "http://127.0.0.1:" + fleet.getAddress().getPort();
        FleetMdmClients clients = new FleetMdmClients(mock(IntegratedToolService.class)) {
            @Override
            public FleetMdmClient client() {
                return new FleetMdmClient(fleetUrl, "synthetic-local-token");
            }
        };
        MachineWriter writer = new MachineWriter(template, absent(), absent());
        FleetHostFactsWriter facts = new FleetHostFactsWriter(machines, writer);
        FleetMdmAgentIdTransformer transformer = new FleetMdmAgentIdTransformer(clients, facts);
        events = mock(ApplicationEventPublisher.class);
        DeviceLifecycleService lifecycle = new DeviceLifecycleService(machines, connections, writer, events, true);
        service = new ToolConnectionService(connections, machines,
                new ToolAgentIdTransformerService(List.of(transformer)), lifecycle);
        THREADS.add(Thread.currentThread().getName());
        MAX_ACTIVE_CASES.accumulateAndGet(ACTIVE_CASES.incrementAndGet(), Math::max);
        log.info("Fleet recovery isolated fixture: db={}, httpPort={}", database, fleet.getAddress().getPort());
    }

    @AfterEach
    void tearDown() {
        ACTIVE_CASES.decrementAndGet();
        if (fleet != null) {
            fleet.stop(0);
        }
        if (template != null) {
            template.getDb().drop();
        }
        if (mongo != null) {
            mongo.close();
        }
    }

    @Test
    void listener_finalUnresolvedDeliveryStoresError_nextClientReportRecovers() {
        // setup
        DirectListener listener = new DirectListener(service);
        Message initialDelivery = report(1);
        Message finalDelivery = report(50);
        Message laterClientReport = report(1);

        // execution
        listener.deliver(initialDelivery);
        Optional<ToolConnection> retryable = connections.findByMachineIdAndToolType(machineId, ToolType.FLEET_MDM);
        listener.deliver(finalDelivery);
        ToolConnection unresolved = stored();
        fleetMode.set("resolved");
        listener.deliver(laterClientReport);

        // verifications
        assertThat(retryable).isEmpty();
        verify(initialDelivery, never()).ack();
        assertThat(unresolved).extracting(ToolConnection::getStatus, ToolConnection::getAgentToolId)
                .containsExactly(ConnectionStatus.ERROR, RAW_ID);
        verify(finalDelivery).ack();
        assertThat(stored()).extracting(ToolConnection::getStatus, ToolConnection::getAgentToolId)
                .containsExactly(ConnectionStatus.CONNECTED, "42");
        verify(laterClientReport).ack();
        assertThat(fleetRequests.get()).isEqualTo(5);
    }

    @Test
    void addToolConnection_unresolvedFleetThenRecovered_promotesOnlyAfterConfirmedRegistration() {
        // setup
        template.updateFirst(Query.query(Criteria.where("machineId").is(machineId)),
                new Update().set("registeredAt", OLD_CONNECTION).set("lastSeen", OLD_CONNECTION.plusSeconds(1)), Machine.class);
        ToolConnection mesh = new ToolConnection();
        mesh.setTenantId("synthetic-tenant");
        mesh.setMachineId(machineId);
        mesh.setToolType(ToolType.MESHCENTRAL);
        mesh.setStatus(ConnectionStatus.CONNECTED);
        mesh.setAgentToolId("synthetic-mesh-node");
        connections.save(mesh);

        // execution
        service.addToolConnection(machineId, "FLEET_MDM", RAW_ID, true);
        Machine pending = template.findOne(Query.query(Criteria.where("machineId").is(machineId)), Machine.class);
        fleetMode.set("resolved");
        service.addToolConnection(machineId, "FLEET_MDM", RAW_ID, false);
        service.addToolConnection(machineId, "FLEET_MDM", RAW_ID, false);

        // verifications
        assertThat(pending.getStatus()).isEqualTo(DeviceStatus.PENDING);
        assertThat(template.findOne(Query.query(Criteria.where("machineId").is(machineId)), Machine.class).getStatus())
                .isEqualTo(DeviceStatus.MANAGED);
        verify(events).publishEvent(org.mockito.ArgumentMatchers.isA(DeviceFirstConnectedEvent.class));
        assertThat(stored()).extracting(ToolConnection::getStatus, ToolConnection::getAgentToolId)
                .containsExactly(ConnectionStatus.CONNECTED, "42");
    }

    @Test
    void listener_mongoRejectsFinalErrorWrite_leavesDeliveryUnacknowledged() {
        // setup
        Document rejectsReportedId = new Document("agentToolId", new Document("$exists", false));
        template.executeCommand(new Document("collMod", "tool_connections").append("validator", rejectsReportedId));
        DirectListener listener = new DirectListener(service);
        Message finalDelivery = report(50);

        // execution
        listener.deliver(finalDelivery);

        // verifications
        verify(finalDelivery, never()).ack();
        assertThat(connections.findByMachineIdAndToolType(machineId, ToolType.FLEET_MDM)).isEmpty();
    }

    @Test
    void addToolConnection_legacyConnectedUuid_recoversNumericHostId() {
        // setup
        seed(ConnectionStatus.CONNECTED, RAW_ID);
        fleetMode.set("resolved");

        // execution
        service.addToolConnection(machineId, "FLEET_MDM", RAW_ID, false);

        // verifications
        assertThat(stored()).extracting(ToolConnection::getStatus, ToolConnection::getAgentToolId,
                        ToolConnection::getMetadata)
                .containsExactly(ConnectionStatus.CONNECTED, "42", "{\"external\":true}");
    }

    @Test
    void addToolConnection_confirmedNumericProviderFailure_preservesConfirmedConnection() {
        // setup
        ToolConnection before = seed(ConnectionStatus.CONNECTED, "42");
        fleetMode.set("failure");

        // execution
        service.addToolConnection(machineId, "FLEET_MDM", RAW_ID, true);

        // verifications
        assertThat(stored()).isEqualTo(before);
    }

    @Test
    void addToolConnection_providerFailureBeforeFinalDelivery_remainsRetryable() {
        // setup
        fleetMode.set("failure");

        // execution
        IllegalStateException failure = assertThrows(IllegalStateException.class,
                () -> service.addToolConnection(machineId, "FLEET_MDM", RAW_ID, false));

        // verifications
        assertThat(failure.getMessage()).contains("Tool registration resolution failed");
        assertThat(connections.findByMachineIdAndToolType(machineId, ToolType.FLEET_MDM)).isEmpty();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(longs = {0, -1})
    void addToolConnection_invalidResolvedHostId_recordsErrorWithoutConnecting(Long hostId) {
        // setup
        fleetMode.set("resolved");
        fleetHostId.set(hostId);

        // execution
        service.addToolConnection(machineId, "FLEET_MDM", RAW_ID, true);

        // verifications
        assertThat(stored()).extracting(ToolConnection::getStatus, ToolConnection::getAgentToolId)
                .containsExactly(ConnectionStatus.ERROR, RAW_ID);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"DELETED", "ARCHIVED"})
    void addToolConnection_terminalMachine_rejectsBeforeProviderLookup(DeviceStatus status) {
        // setup
        template.updateFirst(machineQuery(), new Update().set("status", status), Machine.class);

        // execution
        RuntimeException failure = assertThrows(RuntimeException.class,
                () -> service.addToolConnection(machineId, "FLEET_MDM", RAW_ID, true));

        // verifications
        assertThat(failure.getMessage()).contains("Machine is no longer managed");
        assertThat(fleetRequests.get()).isZero();
        assertThat(connections.findByMachineIdAndToolType(machineId, ToolType.FLEET_MDM)).isEmpty();
    }

    @Test
    void addToolConnection_disconnectDuringLookup_doesNotReconnectStaleGeneration() {
        // setup
        seed(ConnectionStatus.ERROR, RAW_ID);
        fleetMode.set("resolved");
        duringLookup.set(() -> template.updateFirst(machineQuery(), new Update()
                .set("status", ConnectionStatus.DISCONNECTED).set("disconnectedAt", OLD_CONNECTION.plusSeconds(1)), ToolConnection.class));

        // execution
        service.addToolConnection(machineId, "FLEET_MDM", RAW_ID, false);

        // verifications
        assertThat(stored()).extracting(ToolConnection::getStatus, ToolConnection::getAgentToolId,
                        ToolConnection::getDisconnectedAt)
                .containsExactly(ConnectionStatus.DISCONNECTED, RAW_ID, OLD_CONNECTION.plusSeconds(1));
    }

    @Test
    void addToolConnection_newerGenerationDuringLookup_doesNotOverwriteNewerRegistration() {
        // setup
        seed(ConnectionStatus.ERROR, RAW_ID);
        fleetMode.set("resolved");
        duringLookup.set(() -> template.updateFirst(machineQuery(), new Update()
                .set("status", ConnectionStatus.CONNECTED).set("agentToolId", "99")
                .set("connectedAt", OLD_CONNECTION.plusSeconds(2)), ToolConnection.class));

        // execution
        service.addToolConnection(machineId, "FLEET_MDM", RAW_ID, false);

        // verifications
        assertThat(stored()).extracting(ToolConnection::getStatus, ToolConnection::getAgentToolId,
                        ToolConnection::getConnectedAt)
                .containsExactly(ConnectionStatus.CONNECTED, "99", OLD_CONNECTION.plusSeconds(2));
    }

    @Test
    void addToolConnection_metadataChangesDuringLookup_preservesOtherWriterFields() {
        // setup
        seed(ConnectionStatus.ERROR, RAW_ID);
        fleetMode.set("resolved");
        duringLookup.set(() -> template.updateFirst(machineQuery(),
                new Update().set("metadata", "{\"external\":\"new\"}"), ToolConnection.class));

        // execution
        service.addToolConnection(machineId, "FLEET_MDM", RAW_ID, false);

        // verifications
        assertThat(stored()).extracting(ToolConnection::getStatus, ToolConnection::getAgentToolId,
                        ToolConnection::getMetadata)
                .containsExactly(ConnectionStatus.CONNECTED, "42", "{\"external\":\"new\"}");
    }

    @Test
    void addToolConnection_otherTenantHasSameMachineId_onlyUpdatesCurrentTenant() {
        // setup
        seed(ConnectionStatus.ERROR, RAW_ID);
        MongoTemplate otherTenant = new MongoTemplate(mongo, database);
        ToolConnection foreign = new ToolConnection();
        foreign.setTenantId("another-tenant");
        foreign.setMachineId(machineId);
        foreign.setToolType(ToolType.FLEET_MDM);
        foreign.setStatus(ConnectionStatus.CONNECTED);
        foreign.setAgentToolId("99");
        otherTenant.insert(foreign);
        fleetMode.set("resolved");

        // execution
        service.addToolConnection(machineId, "FLEET_MDM", RAW_ID, false);

        // verifications
        assertThat(stored()).extracting(ToolConnection::getTenantId, ToolConnection::getAgentToolId)
                .containsExactly("synthetic-tenant", "42");
        assertThat(otherTenant.findById(foreign.getId(), ToolConnection.class)).isEqualTo(foreign);
    }

    private ToolConnection seed(ConnectionStatus status, String agentId) {
        ToolConnection connection = new ToolConnection();
        connection.setMachineId(machineId);
        connection.setTenantId("synthetic-tenant");
        connection.setToolType(ToolType.FLEET_MDM);
        connection.setAgentToolId(agentId);
        connection.setStatus(status);
        connection.setConnectedAt(OLD_CONNECTION);
        connection.setMetadata("{\"external\":true}");
        return connections.save(connection);
    }

    private ToolConnection stored() {
        return connections.findByMachineIdAndToolType(machineId, ToolType.FLEET_MDM).orElseThrow();
    }

    private Query machineQuery() {
        return Query.query(Criteria.where("machineId").is(machineId));
    }

    private Message report(long deliveredCount) {
        Message message = mock(Message.class);
        NatsJetStreamMetaData metadata = mock(NatsJetStreamMetaData.class);
        String payload = "{\"toolType\":\"FLEET_MDM\",\"agentToolId\":\"" + RAW_ID + "\"}";
        when(message.getData()).thenReturn(payload.getBytes(StandardCharsets.UTF_8));
        when(message.getSubject()).thenReturn("machine." + machineId + ".tool-connection");
        when(message.metaData()).thenReturn(metadata);
        when(metadata.deliveredCount()).thenReturn(deliveredCount);
        return message;
    }

    private static class DirectListener extends ToolConnectionListener {
        private DirectListener(ToolConnectionService service) {
            super(mock(Connection.class), new ObjectMapper(), service, new NatsTopicMachineIdExtractor());
        }

        private void deliver(Message message) {
            handleMessage(message);
        }
    }

    private void respondToFleetLookup(HttpExchange exchange) throws IOException {
        fleetRequests.incrementAndGet();
        Runnable concurrentWriter = duringLookup.getAndSet(null);
        if (concurrentWriter != null) {
            concurrentWriter.run();
        }
        boolean identifierLookup = exchange.getRequestURI().getPath().contains("/identifier/");
        String mode = fleetMode.get();
        int status = "failure".equals(mode) ? 503 : "missing".equals(mode) && identifierLookup ? 404 : 200;
        String host = "{\"id\":" + fleetHostId.get() + ",\"uuid\":\"" + RAW_ID + "\",\"osquery_host_id\":\"" + RAW_ID
                + "\",\"osquery_version\":\"5.12.0\",\"last_enrolled_at\":\"2026-01-01T00:00:00Z\"}";
        String response = "resolved".equals(mode)
                ? identifierLookup ? "{\"host\":" + host + "}" : "{\"hosts\":[" + host + "]}"
                : "{\"hosts\":[]}";
        byte[] body = response.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, body.length);
        exchange.getResponseBody().write(body);
        exchange.close();
    }

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> absent() {
        return mock(ObjectProvider.class);
    }
}
