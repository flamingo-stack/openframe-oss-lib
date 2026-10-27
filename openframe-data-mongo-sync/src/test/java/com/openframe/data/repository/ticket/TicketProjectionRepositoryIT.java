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
        long count = repository.countOutdatedOrganizationNames("tenant-a", "org-1", "New name", 10);

        // verifications
        assertThat(count).isEqualTo(1);
    }

    @Test
    void theCount_stopsAtTheLimit() {
        // setup
        insertOutdatedTickets(5);

        // execution
        long count = repository.countOutdatedOrganizationNames("tenant-c", "org-1", "New name", 3);

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
