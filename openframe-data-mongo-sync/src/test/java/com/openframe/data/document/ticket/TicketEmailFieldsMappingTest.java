package com.openframe.data.document.ticket;

import com.openframe.data.config.MongoConversionsContributor;
import com.openframe.data.config.MongoCustomConversionsConfig;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.convert.NoOpDbRefResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The email origin and the requester of a ticket are read by services that never write them, so
 * their stored keys are a contract: written under exactly these names, read back typed, absent on
 * every other ticket, and kept by a full load and save.
 */
class TicketEmailFieldsMappingTest {

    private static final String EMAIL_ORIGIN = "emailOrigin";
    private static final String REQUESTER = "requester";

    private static final String MAILBOX_ID = "mailbox-1";
    private static final String MAILBOX_ADDRESS = "support@msp.example";
    private static final String SENDER_ADDRESS = "ann@acme.com";
    private static final List<String> CC = List.of("bob@acme.com", "carol@acme.com");

    private static final String ACCOUNT_ID = "org-user-1";
    private static final String REQUESTER_NAME = "Ann Smith";
    private static final String REQUESTER_EMAIL = "ann.smith@acme.com";
    private static final String DIRECTORY_PROVIDER = "MICROSOFT_365";
    private static final String MATCHED_ADDRESS = "ann@acme.com";

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
    void mongoWrite_emailOrigin_storedUnderContractKeys() {
        // setup
        Ticket ticket = Ticket.builder().id("ticket-1").emailOrigin(emailOrigin()).build();

        // execution
        Document stored = write(ticket).get(EMAIL_ORIGIN, Document.class);

        // verifications
        assertThat(stored).containsOnlyKeys("mailboxId", "mailboxAddress", "senderAddress", "cc");
        assertThat(stored)
                .containsEntry("mailboxId", MAILBOX_ID)
                .containsEntry("mailboxAddress", MAILBOX_ADDRESS)
                .containsEntry("senderAddress", SENDER_ADDRESS);
        assertThat(stored.getList("cc", String.class)).containsExactly("bob@acme.com", "carol@acme.com");
    }

    @Test
    void mongoWrite_requester_storedUnderContractKeys() {
        // setup
        Ticket ticket = Ticket.builder().id("ticket-1").requester(requester(TicketRequesterMatch.ALIAS)).build();

        // execution
        Document stored = write(ticket).get(REQUESTER, Document.class);

        // verifications
        assertThat(stored).containsOnlyKeys(
                "accountId", "name", "email", "directoryProvider", "matchedBy", "matchedAddress");
        assertThat(stored)
                .containsEntry("accountId", ACCOUNT_ID)
                .containsEntry("name", REQUESTER_NAME)
                .containsEntry("email", REQUESTER_EMAIL)
                .containsEntry("directoryProvider", DIRECTORY_PROVIDER)
                .containsEntry("matchedBy", "ALIAS")
                .containsEntry("matchedAddress", MATCHED_ADDRESS);
    }

    @ParameterizedTest
    @EnumSource(TicketRequesterMatch.class)
    void mongoWrite_requesterMatchedBy_storedAsEnumName(TicketRequesterMatch matchedBy) {
        // setup
        Ticket ticket = Ticket.builder().id("ticket-1").requester(requester(matchedBy)).build();

        // execution
        Document stored = write(ticket).get(REQUESTER, Document.class);

        // verifications
        assertThat(stored.get("matchedBy")).isEqualTo(matchedBy.name());
    }

    @Test
    void requesterMatch_valuesAreEmailAliasManual() {
        // execution and verifications
        assertThat(TicketRequesterMatch.values())
                .extracting(Enum::name)
                .containsExactly("EMAIL", "ALIAS", "MANUAL");
    }

    @Test
    void mongoRead_storedEmailTicket_emailOriginAndRequesterRead() {
        // setup
        Document stored = new Document("_id", "ticket-1")
                .append(EMAIL_ORIGIN, storedEmailOrigin())
                .append(REQUESTER, storedRequester());

        // execution
        Ticket ticket = converter.read(Ticket.class, stored);

        // verifications
        TicketEmailOrigin origin = ticket.getEmailOrigin();
        assertThat(origin.getMailboxId()).isEqualTo(MAILBOX_ID);
        assertThat(origin.getMailboxAddress()).isEqualTo(MAILBOX_ADDRESS);
        assertThat(origin.getSenderAddress()).isEqualTo(SENDER_ADDRESS);
        assertThat(origin.getCc()).containsExactly("bob@acme.com", "carol@acme.com");
        TicketRequester requester = ticket.getRequester();
        assertThat(requester.getAccountId()).isEqualTo(ACCOUNT_ID);
        assertThat(requester.getName()).isEqualTo(REQUESTER_NAME);
        assertThat(requester.getEmail()).isEqualTo(REQUESTER_EMAIL);
        assertThat(requester.getDirectoryProvider()).isEqualTo(DIRECTORY_PROVIDER);
        assertThat(requester.getMatchedBy()).isEqualTo(TicketRequesterMatch.ALIAS);
        assertThat(requester.getMatchedAddress()).isEqualTo(MATCHED_ADDRESS);
    }

    // guard: green before implementation
    @Test
    void mongoRead_documentWithoutEmailFields_bothNull() {
        // setup
        Document stored = new Document("_id", "ticket-1")
                .append("title", "Printer is on fire")
                .append("statusKind", "TECH_REQUIRED");

        // execution
        Ticket ticket = converter.read(Ticket.class, stored);

        // verifications
        assertThat(ticket.getEmailOrigin()).isNull();
        assertThat(ticket.getRequester()).isNull();
        assertThat(write(ticket)).doesNotContainKeys(EMAIL_ORIGIN, REQUESTER);
    }

    @Test
    void loadChangeStatusAndAssigneeThenSave_keepsEmailOriginAndRequester() {
        // setup
        Document stored = new Document("_id", "ticket-1")
                .append("tenantId", "tenant-1")
                .append("statusId", "st-tech")
                .append("statusKind", "TECH_REQUIRED")
                .append(EMAIL_ORIGIN, storedEmailOrigin())
                .append(REQUESTER, storedRequester());
        Ticket ticket = converter.read(Ticket.class, stored);

        // execution
        ticket.setStatusId("st-custom");
        ticket.setStatusKind(TicketStatusKind.CUSTOM);
        ticket.setAssignedTo("user-2");
        ticket.setAssignedName("Tim Tech");
        Document saved = write(ticket);

        // verifications
        assertThat(saved.get(EMAIL_ORIGIN)).isEqualTo(storedEmailOrigin());
        assertThat(saved.get(REQUESTER)).isEqualTo(storedRequester());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "  "})
    void emailOrigin_withoutMailboxAddress_cannotBeBuilt(String mailboxAddress) {
        // execution and verifications
        assertThatThrownBy(() -> TicketEmailOrigin.builder()
                .mailboxId(MAILBOX_ID)
                .mailboxAddress(mailboxAddress)
                .senderAddress(SENDER_ADDRESS)
                .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("mailboxAddress");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "  "})
    void emailOrigin_withoutSenderAddress_cannotBeBuilt(String senderAddress) {
        // execution and verifications
        assertThatThrownBy(() -> TicketEmailOrigin.builder()
                .mailboxId(MAILBOX_ID)
                .mailboxAddress(MAILBOX_ADDRESS)
                .senderAddress(senderAddress)
                .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("senderAddress");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "  "})
    void requester_withoutAccountId_cannotBeBuilt(String accountId) {
        // execution and verifications
        assertThatThrownBy(() -> TicketRequester.builder()
                .accountId(accountId)
                .matchedBy(TicketRequesterMatch.EMAIL)
                .matchedAddress(MATCHED_ADDRESS)
                .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("accountId");
    }

    @Test
    void requester_withoutMatchedBy_cannotBeBuilt() {
        // execution and verifications
        assertThatThrownBy(() -> TicketRequester.builder()
                .accountId(ACCOUNT_ID)
                .matchedBy(null)
                .matchedAddress(MATCHED_ADDRESS)
                .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("matchedBy");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "  "})
    void requester_withoutMatchedAddress_cannotBeBuilt(String matchedAddress) {
        // execution and verifications
        assertThatThrownBy(() -> TicketRequester.builder()
                .accountId(ACCOUNT_ID)
                .matchedBy(TicketRequesterMatch.EMAIL)
                .matchedAddress(matchedAddress)
                .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("matchedAddress");
    }

    private Document write(Ticket ticket) {
        Document document = new Document();
        converter.write(ticket, document);
        return document;
    }

    private static TicketEmailOrigin emailOrigin() {
        return TicketEmailOrigin.builder()
                .mailboxId(MAILBOX_ID)
                .mailboxAddress(MAILBOX_ADDRESS)
                .senderAddress(SENDER_ADDRESS)
                .cc(CC)
                .build();
    }

    private static TicketRequester requester(TicketRequesterMatch matchedBy) {
        return TicketRequester.builder()
                .accountId(ACCOUNT_ID)
                .name(REQUESTER_NAME)
                .email(REQUESTER_EMAIL)
                .directoryProvider(DIRECTORY_PROVIDER)
                .matchedBy(matchedBy)
                .matchedAddress(MATCHED_ADDRESS)
                .build();
    }

    private static Document storedEmailOrigin() {
        return new Document("mailboxId", MAILBOX_ID)
                .append("mailboxAddress", MAILBOX_ADDRESS)
                .append("senderAddress", SENDER_ADDRESS)
                .append("cc", CC);
    }

    private static Document storedRequester() {
        return new Document("accountId", ACCOUNT_ID)
                .append("name", REQUESTER_NAME)
                .append("email", REQUESTER_EMAIL)
                .append("directoryProvider", DIRECTORY_PROVIDER)
                .append("matchedBy", "ALIAS")
                .append("matchedAddress", MATCHED_ADDRESS);
    }
}
