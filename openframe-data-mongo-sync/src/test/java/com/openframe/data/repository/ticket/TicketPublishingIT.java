package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.ticket.publishing.TicketAggregateSpec;
import com.openframe.data.repository.ticket.publishing.TicketOnTimeEntriesProjection;
import com.openframe.data.repository.timetracking.TimeEntryProjectionRepository;
import com.openframe.publishing.config.AggregateSpecAutoConfiguration;
import com.openframe.publishing.config.OutboxAutoConfiguration;
import com.openframe.publishing.persistence.OutboxEvent;
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
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

// Tenant plane, where TicketRepository exists: a save and the custom updateTitle both publish.
@SpringBootTest(classes = TicketPublishingIT.TestApplication.class,
        properties = {"openframe.events.topics.tickets.enabled=true", "spring.data.mongodb.enabled=true",
                "openframe.events.enabled=true", "openframe.tenant-isolation.enabled=true"})
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class TicketPublishingIT {

    private static final String POD_TENANT = "tenant-1";

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
    void savingATicket_writesItsEventWithTheTitleOnly() {
        Ticket saved = ticketRepository.save(buildTicket("Printer jam"));

        assertThat(mongoTemplate.findAll(OutboxEvent.class)).singleElement().satisfies(row -> {
            assertThat(row.getAggregateType()).isEqualTo("tickets");
            assertThat(row.getAggregateId()).isEqualTo(saved.getId());
            assertThat(row.getTenantId()).isEqualTo(POD_TENANT);
            assertThat(readEvent(row)).containsEntry("ticketId", saved.getId()).containsEntry("title", "Printer jam")
                    .doesNotContainKeys("description");
        });
    }

    @Test
    void aTitleWrittenByUpdateTitle_writesAnEventWithTheNewTitleAndVersion() {
        Ticket saved = ticketRepository.save(buildTicket("Printer jam"));

        ticketRepository.updateTitle(saved.getId(), "Printer jam on floor 2");

        List<OutboxEvent> rows = mongoTemplate.findAll(OutboxEvent.class).stream()
                .sorted(Comparator.comparing(row -> readVersion(row)))
                .toList();
        assertThat(rows).hasSize(2);
        OutboxEvent written = rows.getLast();
        assertThat(readEvent(written)).containsEntry("title", "Printer jam on floor 2");
        Long storedVersion = mongoTemplate.findById(saved.getId(), Ticket.class).getVersion();
        assertThat(readVersion(written)).isEqualTo(storedVersion);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> readEvent(OutboxEvent row) {
        return (Map<String, Object>) row.getPayload().get("event");
    }

    private static long readVersion(OutboxEvent row) {
        Number version = (Number) row.getPayload().get("version");
        return version.longValue();
    }

    private static Ticket buildTicket(String title) {
        Ticket ticket = new Ticket();
        ticket.setTenantId(POD_TENANT);
        ticket.setTicketNumber(1);
        ticket.setTitle(title);
        ticket.setDescription("internal");
        return ticket;
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({MongoAutoConfiguration.class, DataMongoAutoConfiguration.class, AggregateSpecAutoConfiguration.class,
            OutboxAutoConfiguration.class})
    @EnableMongoRepositories(basePackageClasses = TicketRepository.class)
    @Import({TicketAggregateSpec.class, TicketOnTimeEntriesProjection.class, TimeEntryProjectionRepository.class,
            TicketProjectionRepository.class})
    static class TestApplication {

        @Bean
        @Primary
        TenantAwareMongoTemplate mongoTemplate(MongoDatabaseFactory mongoDatabaseFactory, MongoConverter mongoConverter) {
            return new TenantAwareMongoTemplate(mongoDatabaseFactory, mongoConverter, () -> POD_TENANT);
        }
    }
}
