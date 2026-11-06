package com.openframe.data.repository.timetracking;

import com.openframe.data.document.timetracking.TimeEntry;
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

import static org.assertj.core.api.Assertions.assertThat;

// A real Mongo with a plain MongoTemplate, as in the shared stream: the write is scoped only by its own filter.
@SpringBootTest(classes = TimeEntryProjectionRepositoryIT.TestApplication.class)
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class TimeEntryProjectionRepositoryIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getConnectionString);
        registry.add("spring.mongodb.database", () -> "time_entry_projection_it");
    }

    @Autowired private TimeEntryProjectionRepository repository;
    @Autowired private MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(TimeEntry.class);
        mongoTemplate.insertAll(List.of(
                buildTimeEntry("e1", "tenant-a", "ticket-1", "Old"),
                buildTimeEntry("e2", "tenant-a", "ticket-1", "New"),
                buildTimeEntry("e3", "tenant-a", "ticket-2", "Old"),
                buildTimeEntry("e4", "tenant-b", "ticket-1", "Old"),
                buildTimeEntry("e5", "tenant-a", "ticket-1", "Old")));
    }

    @Test
    void theTicketTitle_changesOnlyOnTheTimeEntriesOfTheTenantAndTicket_withAnotherTitle_inBatches() {
        // execution
        long counted = repository.countTimeEntriesToUpdateTicketTitle("tenant-a", "ticket-1", "New", 10);
        String firstLastId = repository.updateTicketTitleBatch("tenant-a", "ticket-1", "New", null, 1);
        long rest = repository.updateTicketTitle("tenant-a", "ticket-1", "New");
        String none = repository.updateTicketTitleBatch("tenant-a", "ticket-1", "New", null, 1);

        // verifications
        assertThat(counted).isEqualTo(2);
        assertThat(firstLastId).isEqualTo("e1");
        assertThat(rest).isEqualTo(1);
        assertThat(none).isNull();
        assertThat(findTitle("e5")).isEqualTo("New");
        assertThat(findTitle("e3")).isEqualTo("Old");
        assertThat(findTitle("e4")).isEqualTo("Old");
    }

    private String findTitle(String id) {
        return mongoTemplate.findById(id, TimeEntry.class).getTicketTitle();
    }

    private static TimeEntry buildTimeEntry(String id, String tenantId, String ticketId, String ticketTitle) {
        return TimeEntry.builder()
                .id(id)
                .tenantId(tenantId)
                .ticketId(ticketId)
                .ticketTitle(ticketTitle)
                .build();
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({MongoAutoConfiguration.class, DataMongoAutoConfiguration.class})
    @Import(TimeEntryProjectionRepository.class)
    static class TestApplication {
    }
}
