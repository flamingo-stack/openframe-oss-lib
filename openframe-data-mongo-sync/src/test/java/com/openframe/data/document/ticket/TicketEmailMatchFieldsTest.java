package com.openframe.data.document.ticket;

import com.openframe.data.config.MongoConversionsContributor;
import com.openframe.data.config.MongoCustomConversionsConfig;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.convert.NoOpDbRefResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

import java.time.Instant;
import java.util.Arrays;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Rule 3 of the inbound pipeline's Match (CONTRACT part B, stage 9; part E, `tickets`): an email ticket keeps its
 * original sender, its normalised subject and the time of its latest email, and the workspace is searched by
 * sender and subject.
 */
class TicketEmailMatchFieldsTest {

    private static final String EMAIL_ORIGIN = "emailOrigin";
    private static final String SUBJECT_KEY = "printer on floor 2 is jammed";
    private static final Instant LAST_EMAIL_AT = Instant.parse("2026-11-19T10:15:30Z");

    private MappingMongoConverter converter;

    @BeforeEach
    void setUp() {
        MongoCustomConversions conversions = new MongoCustomConversionsConfig()
                .mongoCustomConversions(new DefaultListableBeanFactory().getBeanProvider(MongoConversionsContributor.class));
        MongoMappingContext mappingContext = new MongoMappingContext();
        mappingContext.setSimpleTypeHolder(conversions.getSimpleTypeHolder());
        mappingContext.afterPropertiesSet();
        converter = new MappingMongoConverter(NoOpDbRefResolver.INSTANCE, mappingContext);
        converter.setCustomConversions(conversions);
        converter.afterPropertiesSet();
    }

    @Test
    void mongoWrite_emailOriginMatchFields_storedUnderContractKeys() {
        // setup
        Ticket ticket = Ticket.builder().id("ticket-1").emailOrigin(emailOrigin()).build();

        // execution
        Document document = new Document();
        converter.write(ticket, document);
        Document stored = document.get(EMAIL_ORIGIN, Document.class);

        // verifications
        assertThat(stored).containsEntry("subjectKey", SUBJECT_KEY);
        assertThat(stored.get("lastEmailAt")).isEqualTo(Date.from(LAST_EMAIL_AT));
    }

    @Test
    void mongoRead_emailOriginMatchFields_readBackTyped() {
        // setup
        Document stored = new Document("_id", "ticket-1")
                .append(EMAIL_ORIGIN, new Document("mailboxId", "mailbox-1")
                        .append("mailboxAddress", "support@msp.example")
                        .append("senderAddress", "ann@acme.com")
                        .append("subjectKey", SUBJECT_KEY)
                        .append("lastEmailAt", Date.from(LAST_EMAIL_AT)));

        // execution
        TicketEmailOrigin origin = converter.read(Ticket.class, stored).getEmailOrigin();

        // verifications
        assertThat(origin.getSubjectKey()).isEqualTo(SUBJECT_KEY);
        assertThat(origin.getLastEmailAt()).isEqualTo(LAST_EMAIL_AT);
    }

    @Test
    void ticket_declaresSenderSubjectIndex() {
        // execution
        CompoundIndex[] indexes = Ticket.class.getAnnotation(CompoundIndexes.class).value();

        // verifications
        assertThat(Arrays.stream(indexes).map(CompoundIndex::def))
                .contains("{'tenantId': 1, 'emailOrigin.senderAddress': 1, 'emailOrigin.subjectKey': 1}");
    }

    private static TicketEmailOrigin emailOrigin() {
        return TicketEmailOrigin.builder()
                .mailboxId("mailbox-1")
                .mailboxAddress("support@msp.example")
                .senderAddress("ann@acme.com")
                .subjectKey(SUBJECT_KEY)
                .lastEmailAt(LAST_EMAIL_AT)
                .build();
    }
}
