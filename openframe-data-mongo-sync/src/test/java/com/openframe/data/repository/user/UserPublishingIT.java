package com.openframe.data.repository.user;

import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.auth.AuthUserRepository;
import com.openframe.data.repository.ticket.TicketProjectionRepository;
import com.openframe.data.repository.user.publishing.UserAggregateSpec;
import com.openframe.data.repository.user.publishing.UserOnTicketsProjection;
import com.openframe.publishing.config.AggregateSpecAutoConfiguration;
import com.openframe.publishing.config.OutboxAutoConfiguration;
import com.openframe.publishing.config.OutboxIndexAutoConfiguration;
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
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

// The real UserRepository and AuthUserRepository with UserAggregateSpec: AuthUser is a User, so its saves publish too.
@SpringBootTest(classes = UserPublishingIT.TestApplication.class,
        properties = {"openframe.events.topics.users.enabled=true", "spring.data.mongodb.enabled=true",
                "openframe.events.enabled=true"})
@Testcontainers
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class UserPublishingIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7")).withReplicaSet();

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getReplicaSetUrl);
    }

    @Autowired private UserRepository userRepository;
    @Autowired private AuthUserRepository authUserRepository;
    @Autowired private MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(User.class);
        mongoTemplate.dropCollection(OutboxEvent.class);
        mongoTemplate.createCollection(User.class);
        mongoTemplate.createCollection(OutboxEvent.class);
    }

    @Test
    void savingAUser_writesItsEventWithTheNamesOnly() {
        User saved = userRepository.save(user("Ada", "Lovelace"));

        assertThat(mongoTemplate.findAll(OutboxEvent.class)).singleElement().satisfies(row -> {
            assertThat(row.getAggregateType()).isEqualTo("users");
            assertThat(row.getAggregateId()).isEqualTo(saved.getId());
            assertThat(row.getTenantId()).isEqualTo("tenant-1");
            assertThat(readEvent(row)).containsEntry("userId", saved.getId()).containsEntry("firstName", "Ada")
                    .containsEntry("lastName", "Lovelace").doesNotContainKeys("email", "fullName");
        });
    }

    @Test
    void savingAnAuthUser_writesAUsersEvent() {
        AuthUser authUser = AuthUser.builder()
                .tenantId("tenant-1")
                .email("grace@example.com")
                .firstName("Grace")
                .lastName("Hopper")
                .passwordHash("hash")
                .build();

        AuthUser saved = authUserRepository.save(authUser);

        List<OutboxEvent> rows = mongoTemplate.findAll(OutboxEvent.class);
        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.getAggregateType()).isEqualTo("users");
            assertThat(row.getAggregateId()).isEqualTo(saved.getId());
            assertThat(readEvent(row)).containsEntry("firstName", "Grace").doesNotContainKeys("passwordHash");
        });
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> readEvent(OutboxEvent row) {
        return (Map<String, Object>) row.getPayload().get("event");
    }

    // The reconcile reads only the names, not whole users.
    @Test
    void theReconcileRead_returnsTheNamesOnly() {
        User saved = userRepository.save(user("Ada", "Lovelace"));
        Set<String> tenantIds = Set.of("tenant-1");
        Set<String> userIds = Set.of(saved.getId());

        List<User> found = userRepository.findByTenantIdInAndIdIn(tenantIds, userIds);

        assertThat(found).singleElement().satisfies(user -> {
            assertThat(user.getFirstName()).isEqualTo("Ada");
            assertThat(user.getEmail()).isNull();
        });
    }

    private static User user(String firstName, String lastName) {
        return User.builder()
                .tenantId("tenant-1")
                .email("ada@example.com")
                .firstName(firstName)
                .lastName(lastName)
                .build();
    }

    // Only what a service gets from these modules: not @EnableAutoConfiguration, which would also load MongoSyncConfig.
    @SpringBootConfiguration
    @ImportAutoConfiguration({MongoAutoConfiguration.class, DataMongoAutoConfiguration.class, AggregateSpecAutoConfiguration.class,
            OutboxAutoConfiguration.class, OutboxIndexAutoConfiguration.class})
    @EnableMongoRepositories(basePackageClasses = {UserRepository.class, AuthUserRepository.class})
    @Import({UserAggregateSpec.class, UserOnTicketsProjection.class, TicketProjectionRepository.class})
    static class TestApplication {
    }
}
