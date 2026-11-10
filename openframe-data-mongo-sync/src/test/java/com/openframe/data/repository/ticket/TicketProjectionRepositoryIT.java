package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.data.mongodb.autoconfigure.DataMongoAutoConfiguration;
import org.springframework.boot.mongodb.autoconfigure.MongoAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

// A real Mongo with a plain MongoTemplate, as in the shared stream: the write is scoped only by its own filter.
@SpringBootTest(classes = TicketProjectionRepositoryIT.TestApplication.class)
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class TicketProjectionRepositoryIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getConnectionString);
        registry.add("spring.mongodb.database", () -> "ticket_projection_it");
    }

    @Autowired private TicketProjectionRepository repository;
    @Autowired private MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Ticket.class);
        mongoTemplate.insertAll(List.of(
                ticket("t1", 1, "tenant-a", "org-1", "Old name"),
                ticket("t2", 2, "tenant-a", "org-1", "New name"),
                ticket("t3", 3, "tenant-a", "org-2", "Old name"),
                ticket("t4", 4, "tenant-b", "org-1", "Old name")));
    }

    @Test
    void onlyTheTicketsOfTheTenantAndOrganization_withAnotherName_change() {
        // execution
        long updated = repository.updateOrganizationName("tenant-a", "org-1", "New name");

        // verifications
        assertThat(updated).isEqualTo(1);
        assertThat(nameOf("t1")).isEqualTo("New name");
        assertThat(nameOf("t2")).isEqualTo("New name");
        assertThat(nameOf("t3")).isEqualTo("Old name");
        assertThat(nameOf("t4")).isEqualTo("Old name");
    }

    @Test
    void anUpdatedTicket_getsANewVersion_soAStaleCopyFailsToSave() {
        // execution
        repository.updateOrganizationName("tenant-a", "org-1", "New name");

        // verifications
        assertThat(versionOf("t1")).isEqualTo(1L);
        assertThat(versionOf("t2")).isZero();
    }

    @Test
    void theSameEventAgain_changesNothing() {
        // setup
        repository.updateOrganizationName("tenant-a", "org-1", "New name");

        // execution
        long updated = repository.updateOrganizationName("tenant-a", "org-1", "New name");

        // verifications
        assertThat(updated).isZero();
        assertThat(versionOf("t1")).isEqualTo(1L);
    }

    @Test
    void theCount_coversOnlyTheOutdatedTicketsOfTheTenantAndOrganization() {
        // execution
        long count = repository.countTicketsToUpdateOrganizationName("tenant-a", "org-1", "New name", 10);

        // verifications
        assertThat(count).isEqualTo(1);
    }

    @Test
    void theCount_stopsAtTheLimit() {
        // setup
        insertOutdatedTickets(5);

        // execution
        long count = repository.countTicketsToUpdateOrganizationName("tenant-c", "org-1", "New name", 3);

        // verifications
        assertThat(count).isEqualTo(3);
    }

    @Test
    void batches_changeEveryOutdatedTicketInIdOrder_thenReturnNull() {
        // setup
        List<String> ids = insertOutdatedTickets(5);

        // execution
        String firstLastId = repository.updateOrganizationNameBatch("tenant-c", "org-1", "New name", null, 2);
        String secondLastId = repository.updateOrganizationNameBatch("tenant-c", "org-1", "New name", firstLastId, 2);
        String thirdLastId = repository.updateOrganizationNameBatch("tenant-c", "org-1", "New name", secondLastId, 2);
        String fourthLastId = repository.updateOrganizationNameBatch("tenant-c", "org-1", "New name", thirdLastId, 2);

        // verifications
        assertThat(firstLastId).isEqualTo(ids.get(1));
        assertThat(secondLastId).isEqualTo(ids.get(3));
        assertThat(thirdLastId).isEqualTo(ids.get(4));
        assertThat(fourthLastId).isNull();
        assertThat(ids).allSatisfy(id -> assertThat(nameOf(id)).isEqualTo("New name"));
        assertThat(nameOf("t4")).isEqualTo("Old name");
    }

    @Test
    void aBatch_changesOnlyTheTenantAndOrganization_andBumpsTheVersion() {
        // execution
        String lastId = repository.updateOrganizationNameBatch("tenant-a", "org-1", "New name", null, 10);

        // verifications
        assertThat(lastId).isEqualTo("t1");
        assertThat(nameOf("t1")).isEqualTo("New name");
        assertThat(versionOf("t1")).isEqualTo(1L);
        assertThat(versionOf("t2")).isZero();
        assertThat(nameOf("t3")).isEqualTo("Old name");
        assertThat(nameOf("t4")).isEqualTo("Old name");
    }

    // ObjectId ids, as on real tickets, so the _id order and the "after lastId" filter are checked on ObjectIds.
    private List<String> insertOutdatedTickets(int count) {
        List<Ticket> tickets = IntStream.range(0, count)
                .mapToObj(index -> ticket(ObjectId.get().toHexString(), 100 + index, "tenant-c", "org-1", "Old name"))
                .toList();
        mongoTemplate.insertAll(tickets);
        return tickets.stream().map(Ticket::getId).sorted().toList();
    }

    @Test
    void bothUserNames_changeOnlyOnTheTicketsOfTheTenantThatNameTheUser_withAnotherName() {
        // setup
        mongoTemplate.insertAll(List.of(
                userTicket("u1", 11, "tenant-a", "user-1", "Old", null, null),
                userTicket("u2", 12, "tenant-a", "user-2", "Old", "user-1", "Old"),
                userTicket("u3", 13, "tenant-a", "user-1", "Ada Lovelace", null, null),
                userTicket("u4", 14, "tenant-b", "user-1", "Old", "user-1", "Old")));

        // execution
        long counted = repository.countTicketsToUpdateUserName("tenant-a", "user-1", "Ada Lovelace", 10);
        long updated = repository.updateUserNames("tenant-a", "user-1", "Ada Lovelace");

        // verifications
        assertThat(counted).isEqualTo(2);
        assertThat(updated).isEqualTo(2);
        assertThat(mongoTemplate.findById("u1", Ticket.class).getAssignedName()).isEqualTo("Ada Lovelace");
        assertThat(mongoTemplate.findById("u2", Ticket.class).getAssignedName()).isEqualTo("Old");
        assertThat(mongoTemplate.findById("u2", Ticket.class).getResolvedByName()).isEqualTo("Ada Lovelace");
        assertThat(versionOf("u3")).isZero();
        assertThat(mongoTemplate.findById("u4", Ticket.class).getAssignedName()).isEqualTo("Old");
    }

    @Test
    void userNames_changeInBatches_overTicketsWithEitherNameOutdated() {
        // setup
        mongoTemplate.insertAll(List.of(
                userTicket("r1", 21, "tenant-a", "user-1", "Old", null, null),
                userTicket("r2", 22, "tenant-a", null, null, "user-1", "Old"),
                userTicket("r3", 23, "tenant-a", "user-2", "Old", "user-2", "Old")));

        // execution
        String firstLastId = repository.updateUserNamesBatch("tenant-a", "user-1", "Ada Lovelace", null, 1);
        String secondLastId = repository.updateUserNamesBatch("tenant-a", "user-1", "Ada Lovelace", firstLastId, 1);
        String none = repository.updateUserNamesBatch("tenant-a", "user-1", "Ada Lovelace", secondLastId, 1);

        // verifications
        assertThat(firstLastId).isEqualTo("r1");
        assertThat(secondLastId).isEqualTo("r2");
        assertThat(none).isNull();
        assertThat(mongoTemplate.findById("r1", Ticket.class).getAssignedName()).isEqualTo("Ada Lovelace");
        assertThat(mongoTemplate.findById("r2", Ticket.class).getResolvedByName()).isEqualTo("Ada Lovelace");
        assertThat(mongoTemplate.findById("r3", Ticket.class).getAssignedName()).isEqualTo("Old");
    }

    @Test
    void theDeviceHostname_changesOnlyOnTheTicketsOfTheTenantAndDevice_withAnotherHostname_inBatches() {
        // setup
        mongoTemplate.insertAll(List.of(
                deviceTicket("d1", 31, "tenant-a", "machine-1", "host-old"),
                deviceTicket("d2", 32, "tenant-a", "machine-1", "host-new"),
                deviceTicket("d3", 33, "tenant-a", "machine-2", "host-old"),
                deviceTicket("d4", 34, "tenant-b", "machine-1", "host-old"),
                deviceTicket("d5", 35, "tenant-a", "machine-1", "host-old")));

        // execution
        long counted = repository.countTicketsToUpdateDeviceHostname("tenant-a", "machine-1", "host-new", 10);
        String firstLastId = repository.updateDeviceHostnameBatch("tenant-a", "machine-1", "host-new", null, 1);
        long rest = repository.updateDeviceHostname("tenant-a", "machine-1", "host-new");

        // verifications
        assertThat(counted).isEqualTo(2);
        assertThat(firstLastId).isEqualTo("d1");
        assertThat(rest).isEqualTo(1);
        assertThat(mongoTemplate.findById("d5", Ticket.class).getDeviceHostname()).isEqualTo("host-new");
        assertThat(mongoTemplate.findById("d3", Ticket.class).getDeviceHostname()).isEqualTo("host-old");
        assertThat(mongoTemplate.findById("d4", Ticket.class).getDeviceHostname()).isEqualTo("host-old");
    }

    private static Ticket deviceTicket(String id, int number, String tenantId, String deviceId, String deviceHostname) {
        Ticket ticket = ticket(id, number, tenantId, "org-9", "Org");
        ticket.setDeviceId(deviceId);
        ticket.setDeviceHostname(deviceHostname);
        return ticket;
    }

    private static Ticket userTicket(String id, int number, String tenantId, String assignedTo, String assignedName,
                                     String resolvedById, String resolvedByName) {
        Ticket ticket = ticket(id, number, tenantId, "org-9", "Org");
        ticket.setAssignedTo(assignedTo);
        ticket.setAssignedName(assignedName);
        ticket.setResolvedById(resolvedById);
        ticket.setResolvedByName(resolvedByName);
        return ticket;
    }

    private String nameOf(String id) {
        return mongoTemplate.findById(id, Ticket.class).getOrganizationName();
    }

    private Long versionOf(String id) {
        return mongoTemplate.findById(id, Ticket.class).getVersion();
    }

    private static Ticket ticket(String id, int number, String tenantId, String organizationId, String organizationName) {
        Ticket ticket = new Ticket();
        ticket.setId(id);
        ticket.setTicketNumber(number);
        ticket.setTenantId(tenantId);
        ticket.setOrganizationId(organizationId);
        ticket.setOrganizationName(organizationName);
        ticket.setVersion(0L);
        return ticket;
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({MongoAutoConfiguration.class, DataMongoAutoConfiguration.class})
    @Import(TicketProjectionRepository.class)
    static class TestApplication {
    }
}
