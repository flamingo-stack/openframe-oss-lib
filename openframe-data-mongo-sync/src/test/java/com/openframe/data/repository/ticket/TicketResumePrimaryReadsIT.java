package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketAttachment;
import com.openframe.data.document.ticket.TicketNote;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
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
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Primary;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

// The email resume reads through these on the tenant plane: each must stay fenced to the pod's tenant.
@SpringBootTest(classes = TicketResumePrimaryReadsIT.TestApplication.class,
        properties = "openframe.tenant-isolation.enabled=true")
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class TicketResumePrimaryReadsIT extends BaseMongoIntegrationTest {

    private static final String POD_TENANT = "tenant-1";
    private static final String OTHER_TENANT = "tenant-2";
    private static final String TICKET_ID = "ticket-1";
    private static final String PATH = "attachments/ticket-1/email-receipt-1/1-invoice.pdf";

    @Autowired private TicketRepository tickets;
    @Autowired private TicketAttachmentRepository attachments;
    @Autowired private TicketNoteRepository notes;
    @Autowired private TenantAwareMongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Ticket.class);
        mongoTemplate.dropCollection(TicketAttachment.class);
        mongoTemplate.dropCollection(TicketNote.class);
    }

    @Test
    void findByIdFromPrimary_podTenantTicket_found() {
        // setup
        Ticket own = mongoTemplate.insert(ticket(POD_TENANT, 1));

        // execution
        Optional<Ticket> found = tickets.findByIdFromPrimary(own.getId());

        // verifications
        assertThat(found).map(Ticket::getId).contains(own.getId());
    }

    @Test
    void findByIdFromPrimary_otherTenantTicket_empty() {
        // setup
        Ticket foreign = mongoTemplate.insert(ticket(OTHER_TENANT, 2));

        // execution
        Optional<Ticket> found = tickets.findByIdFromPrimary(foreign.getId());

        // verifications
        assertThat(found).isEmpty();
    }

    @Test
    void existsByIdFromPrimary_podTenantTicket_true() {
        // setup
        Ticket own = mongoTemplate.insert(ticket(POD_TENANT, 1));

        // execution
        boolean exists = tickets.existsByIdFromPrimary(own.getId());

        // verifications
        assertThat(exists).isTrue();
    }

    @Test
    void existsByIdFromPrimary_otherTenantTicket_false() {
        // setup
        Ticket foreign = mongoTemplate.insert(ticket(OTHER_TENANT, 2));

        // execution
        boolean exists = tickets.existsByIdFromPrimary(foreign.getId());

        // verifications
        assertThat(exists).isFalse();
    }

    @Test
    void findByTicketIdAndStoragePathFromPrimary_podTenantRow_found() {
        // setup
        TicketAttachment own = mongoTemplate.insert(attachment(POD_TENANT));

        // execution
        Optional<TicketAttachment> found = attachments.findByTicketIdAndStoragePathFromPrimary(TICKET_ID, PATH);

        // verifications
        assertThat(found).map(TicketAttachment::getId).contains(own.getId());
    }

    @Test
    void findByTicketIdAndStoragePathFromPrimary_otherTenantRow_empty() {
        // setup
        mongoTemplate.insert(attachment(OTHER_TENANT));

        // execution
        Optional<TicketAttachment> found = attachments.findByTicketIdAndStoragePathFromPrimary(TICKET_ID, PATH);

        // verifications
        assertThat(found).isEmpty();
    }

    @Test
    void existsByIdFromPrimary_podTenantNote_true() {
        // setup
        TicketNote own = mongoTemplate.insert(note(POD_TENANT));

        // execution
        boolean exists = notes.existsByIdFromPrimary(own.getId());

        // verifications
        assertThat(exists).isTrue();
    }

    @Test
    void existsByIdFromPrimary_otherTenantNote_false() {
        // setup
        TicketNote foreign = mongoTemplate.insert(note(OTHER_TENANT));

        // execution
        boolean exists = notes.existsByIdFromPrimary(foreign.getId());

        // verifications
        assertThat(exists).isFalse();
    }

    @Test
    void existsByIdFromPrimary_missingNote_false() {
        // setup
        mongoTemplate.insert(note(POD_TENANT));

        // execution
        boolean exists = notes.existsByIdFromPrimary("missing-note");

        // verifications
        assertThat(exists).isFalse();
    }

    private static Ticket ticket(String tenantId, int ticketNumber) {
        Ticket ticket = new Ticket();
        ticket.setTenantId(tenantId);
        ticket.setTicketNumber(ticketNumber);
        ticket.setTitle("Printer jam");
        return ticket;
    }

    private static TicketAttachment attachment(String tenantId) {
        return TicketAttachment.builder()
                .tenantId(tenantId)
                .ticketId(TICKET_ID)
                .fileName("invoice.pdf")
                .contentType("application/pdf")
                .fileSize(10L)
                .storagePath(PATH)
                .uploadedBy("email")
                .build();
    }

    private static TicketNote note(String tenantId) {
        return TicketNote.builder()
                .tenantId(tenantId)
                .ticketId(TICKET_ID)
                .content("email attachments")
                .build();
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({MongoAutoConfiguration.class, DataMongoAutoConfiguration.class})
    @EnableMongoRepositories(basePackageClasses = TicketRepository.class,
            includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                    classes = {TicketRepository.class, TicketAttachmentRepository.class, TicketNoteRepository.class}))
    static class TestApplication {

        @Bean
        @Primary
        TenantAwareMongoTemplate mongoTemplate(MongoDatabaseFactory mongoDatabaseFactory, MongoConverter mongoConverter) {
            return new TenantAwareMongoTemplate(mongoDatabaseFactory, mongoConverter, () -> POD_TENANT);
        }
    }
}
