package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.MachineIntegrationTestApplication;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Pins the exceptions a save gives once Ticket has @Version: callers (409 mapping, Mingo's tool error rules) match on these types.
@SpringBootTest(classes = MachineIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class TicketOptimisticLockingIT extends BaseMongoIntegrationTest {

    @Autowired
    private MongoTemplate mongoTemplate;

    private String ticketId;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(Ticket.class);
        Ticket saved = mongoTemplate.save(Ticket.builder().tenantId("tenant-1").ticketNumber(1).title("Printer").build());
        ticketId = saved.getId();
    }

    @Test
    void aSaveFromAStaleCopyFailsWithOptimisticLockingFailure() {
        Ticket first = mongoTemplate.findById(ticketId, Ticket.class);
        Ticket second = mongoTemplate.findById(ticketId, Ticket.class);
        first.setTitle("Printer on floor 2");
        mongoTemplate.save(first);

        second.setStatusKind(TicketStatusKind.TECH_REQUIRED);

        assertThatThrownBy(() -> mongoTemplate.save(second))
                .isExactlyInstanceOf(OptimisticLockingFailureException.class);
        Ticket stored = mongoTemplate.findById(ticketId, Ticket.class);
        assertThat(stored.getTitle()).isEqualTo("Printer on floor 2");
        assertThat(stored.getStatusKind()).isNull();
    }

    @Test
    void eachSaveIncrementsTheVersion() {
        Ticket ticket = mongoTemplate.findById(ticketId, Ticket.class);
        Long before = ticket.getVersion();

        Ticket saved = mongoTemplate.save(ticket);

        assertThat(saved.getVersion()).isEqualTo(before + 1);
    }

    @Test
    void aDocumentWithoutVersionIsTreatedAsNewAndFailsWithDuplicateKey() {
        mongoTemplate.getCollection("tickets").updateOne(new Document("_id", new ObjectId(ticketId)),
                new Document("$unset", new Document("version", "")));
        Ticket withoutVersion = mongoTemplate.findById(ticketId, Ticket.class);

        assertThat(withoutVersion.getVersion()).isNull();
        assertThatThrownBy(() -> mongoTemplate.save(withoutVersion))
                .isInstanceOf(DuplicateKeyException.class);
    }
}
