package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.TicketAttachment;
import com.openframe.data.integration.BaseMongoIntegrationTest;
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
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = TicketAttachmentRepositoryIT.TestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class TicketAttachmentRepositoryIT extends BaseMongoIntegrationTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String TICKET_ID = "ticket-1";
    private static final String OTHER_TICKET_ID = "ticket-2";
    private static final String PATH = "attachments/ticket-1/email-receipt-1/1-invoice.pdf";
    private static final String OTHER_PATH = "attachments/ticket-1/email-receipt-1/2-photo.png";

    @Autowired private TicketAttachmentRepository repository;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
    }

    @Test
    void findByTicketIdAndStoragePathFromPrimary_matchesOnlyThatTicketAndPath() {
        // setup
        TicketAttachment target = repository.save(attachment(TICKET_ID, PATH));
        repository.save(attachment(TICKET_ID, OTHER_PATH));
        repository.save(attachment(OTHER_TICKET_ID, PATH));

        // execution
        Optional<TicketAttachment> found = repository.findByTicketIdAndStoragePathFromPrimary(TICKET_ID, PATH);

        // verifications
        assertThat(found).map(TicketAttachment::getId).contains(target.getId());
    }

    private static TicketAttachment attachment(String ticketId, String storagePath) {
        return TicketAttachment.builder()
                .tenantId(TENANT_ID)
                .ticketId(ticketId)
                .fileName("file")
                .contentType("application/octet-stream")
                .fileSize(10L)
                .storagePath(storagePath)
                .uploadedBy("email")
                .build();
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({MongoAutoConfiguration.class, DataMongoAutoConfiguration.class})
    @EnableMongoRepositories(basePackageClasses = TicketAttachmentRepository.class,
            includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                    classes = TicketAttachmentRepository.class))
    static class TestApplication {
    }
}
