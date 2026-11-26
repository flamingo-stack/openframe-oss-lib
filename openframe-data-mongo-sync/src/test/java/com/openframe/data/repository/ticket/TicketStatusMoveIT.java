package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.publishing.persistence.OutboxEvent;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = TicketPublishingIT.TestApplication.class,
        properties = {"openframe.events.topics.tickets.enabled=true", "spring.data.mongodb.enabled=true",
                "openframe.events.enabled=true", "openframe.tenant-isolation.enabled=true"})
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class TicketStatusMoveIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7")).withReplicaSet();

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getReplicaSetUrl);
    }

    @Autowired private TicketRepository ticketRepository;
    @Autowired private TenantAwareMongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Ticket.class);
        mongoTemplate.dropCollection(OutboxEvent.class);
        mongoTemplate.createCollection(Ticket.class);
        mongoTemplate.createCollection(OutboxEvent.class);
    }

    @Test
    void moveToStatusIfStillIn_ticketStillInTheStatus_returnsItAsItWasWithTheFieldsItsAuditRecordNeeds() {
        Ticket resolved = ticketRepository.save(ticketIn("st-resolved", TicketStatusKind.RESOLVED));

        Optional<Ticket> moved = ticketRepository.moveToStatusIfStillIn(resolved.getId(), "st-resolved", "st-archived",
                TicketStatusKind.ARCHIVED);

        assertThat(moved).get()
                .returns(resolved.getId(), Ticket::getId)
                .returns("Printer offline", Ticket::getTitle)
                .returns(7, Ticket::getTicketNumber)
                .returns("org-1", Ticket::getOrganizationId)
                .returns("machine-1", Ticket::getDeviceId)
                .returns("st-resolved", Ticket::getStatusId)
                .returns(TicketStatusKind.RESOLVED, Ticket::getStatusKind);
    }

    @Test
    void moveToStatusIfStillIn_ticketStillInTheStatus_storesTheNewStatusAsAnUpdateOfTheTicket() {
        Ticket resolved = ticketRepository.save(ticketIn("st-resolved", TicketStatusKind.RESOLVED));

        ticketRepository.moveToStatusIfStillIn(resolved.getId(), "st-resolved", "st-archived", TicketStatusKind.ARCHIVED);

        assertThat(ticketRepository.findById(resolved.getId())).get()
                .returns("st-archived", Ticket::getStatusId)
                .returns(TicketStatusKind.ARCHIVED, Ticket::getStatusKind)
                .returns(resolved.getVersion() + 1, Ticket::getVersion)
                .satisfies(stored -> assertThat(stored.getUpdatedAt()).isNotNull());
    }

    @Test
    void moveToStatusIfStillIn_ticketLeftTheStatus_changesNothing() {
        Ticket reopened = ticketRepository.save(ticketIn("st-tech", TicketStatusKind.TECH_REQUIRED));

        Optional<Ticket> moved = ticketRepository.moveToStatusIfStillIn(reopened.getId(), "st-resolved", "st-archived",
                TicketStatusKind.ARCHIVED);

        assertThat(moved).isEmpty();
        assertThat(ticketRepository.findById(reopened.getId())).get()
                .returns("st-tech", Ticket::getStatusId)
                .returns(TicketStatusKind.TECH_REQUIRED, Ticket::getStatusKind);
    }

    @Test
    void moveToStatusIfStillIn_ticketOfAnotherTenant_changesNothing() {
        mongoTemplate.getCollection("tickets").insertOne(new Document("_id", "ticket-of-tenant-2")
                .append("tenantId", "tenant-2")
                .append("statusId", "st-resolved"));

        Optional<Ticket> moved = ticketRepository.moveToStatusIfStillIn("ticket-of-tenant-2", "st-resolved",
                "st-archived", TicketStatusKind.ARCHIVED);

        assertThat(moved).isEmpty();
        assertThat(mongoTemplate.getCollection("tickets").find(new Document("_id", "ticket-of-tenant-2")).first())
                .containsEntry("statusId", "st-resolved");
    }

    private static Ticket ticketIn(String statusId, TicketStatusKind statusKind) {
        Ticket ticket = new Ticket();
        ticket.setTenantId("tenant-1");
        ticket.setTicketNumber(7);
        ticket.setTitle("Printer offline");
        ticket.setOrganizationId("org-1");
        ticket.setDeviceId("machine-1");
        ticket.setStatusId(statusId);
        ticket.setStatusKind(statusKind);
        return ticket;
    }
}
