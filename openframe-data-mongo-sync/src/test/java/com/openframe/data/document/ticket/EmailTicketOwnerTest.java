package com.openframe.data.document.ticket;

import com.openframe.data.config.MongoConversionsContributor;
import com.openframe.data.config.MongoCustomConversionsConfig;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.convert.NoOpDbRefResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The class name and package of the email owner are stored data ({@code owner._class}), so the
 * stored shape is pinned with literals, never with {@code getName()}.
 */
class EmailTicketOwnerTest {

    private static final String ADDRESS = "ann@acme.com";
    private static final String STORED_CLASS = "com.openframe.data.document.ticket.EmailTicketOwner";

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
    void constructor_address_typeIsEmail() {
        // execution
        EmailTicketOwner owner = new EmailTicketOwner(ADDRESS);

        // verifications
        assertThat(owner.getType()).isEqualTo(TicketOwnerType.EMAIL);
        assertThat(owner.getAddress()).isEqualTo(ADDRESS);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "  "})
    void constructor_withoutAddress_cannotBeBuilt(String address) {
        // execution and verifications
        assertThatThrownBy(() -> new EmailTicketOwner(address))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("address");
    }

    @Test
    void mongoWrite_ticketWithEmailOwner_storesTicketOwnerTypeEmail() {
        // execution
        Document owner = writtenOwner();

        // verifications
        assertThat(owner).containsEntry("ticketOwnerType", "EMAIL");
        assertThat(owner).doesNotContainKey("type");
    }

    @Test
    void mongoWrite_ticketWithEmailOwner_storesAddress() {
        // execution
        Document owner = writtenOwner();

        // verifications
        assertThat(owner).containsEntry("address", ADDRESS);
    }

    @Test
    void mongoWrite_ticketWithEmailOwner_storesClassNameAsData() {
        // execution
        Document owner = writtenOwner();

        // verifications
        assertThat(owner).containsEntry("_class", STORED_CLASS);
    }

    @Test
    void mongoRead_storedEmailOwnerDocument_readsBackEqual() {
        // setup
        Document stored = new Document("_id", "ticket-1")
                .append("owner", new Document("ticketOwnerType", "EMAIL")
                        .append("address", ADDRESS)
                        .append("_class", STORED_CLASS));
        Document written = new Document();
        converter.write(emailOwnedTicket(), written);

        // execution
        Ticket fromStored = converter.read(Ticket.class, stored);
        Ticket fromWritten = converter.read(Ticket.class, written);

        // verifications
        assertThat(fromStored.getOwner()).isEqualTo(new EmailTicketOwner(ADDRESS));
        assertThat(fromWritten.getOwner()).isEqualTo(new EmailTicketOwner(ADDRESS));
        assertReadAsEmailOwner(fromStored.getOwner());
        assertReadAsEmailOwner(fromWritten.getOwner());
    }

    @Test
    void jacksonRead_typeEmailAsTicketOwner_returnsEmailTicketOwner() {
        // setup
        JsonMapper mapper = JsonMapper.builder().build();

        // execution
        TicketOwner fromJson = mapper.readValue("{\"type\":\"EMAIL\",\"address\":\"ann@acme.com\"}", TicketOwner.class);
        TicketOwner roundTripped = mapper.readValue(
                mapper.writeValueAsString(new EmailTicketOwner(ADDRESS)), TicketOwner.class);

        // verifications
        assertThat(fromJson).isInstanceOf(EmailTicketOwner.class);
        assertThat(((EmailTicketOwner) fromJson).getAddress()).isEqualTo(ADDRESS);
        assertThat(roundTripped).isInstanceOf(EmailTicketOwner.class);
        assertThat(((EmailTicketOwner) roundTripped).getAddress()).isEqualTo(ADDRESS);
    }

    private static void assertReadAsEmailOwner(TicketOwner owner) {
        assertThat(owner).isInstanceOf(EmailTicketOwner.class);
        assertThat(owner.getType()).isEqualTo(TicketOwnerType.EMAIL);
        assertThat(((EmailTicketOwner) owner).getAddress()).isEqualTo(ADDRESS);
    }

    private Document writtenOwner() {
        Document document = new Document();
        converter.write(emailOwnedTicket(), document);
        return document.get("owner", Document.class);
    }

    private static Ticket emailOwnedTicket() {
        return Ticket.builder()
                .id("ticket-1")
                .tenantId("tenant-1")
                .owner(new EmailTicketOwner(ADDRESS))
                .build();
    }
}
