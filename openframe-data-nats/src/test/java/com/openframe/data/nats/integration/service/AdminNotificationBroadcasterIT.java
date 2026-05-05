package com.openframe.data.nats.integration.service;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.nats.integration.BaseIntegrationTest;
import com.openframe.data.nats.integration.support.BroadcasterIntegrationTestApplication;
import com.openframe.data.nats.service.AdminNotificationBroadcaster;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.repository.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        classes = BroadcasterIntegrationTestApplication.class,
        properties = "spring.cloud.stream.enabled=false"
)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class AdminNotificationBroadcasterIT extends BaseIntegrationTest {

    @Autowired
    private AdminNotificationBroadcaster broadcaster;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollections() {
        mongoTemplate.dropCollection(User.class);
        mongoTemplate.dropCollection(Notification.class);
    }

    @Test
    @DisplayName("Given active admins, owners and a regular user, when broadcasting, then exactly one notification is emitted per admin and per owner — never to the regular user")
    void given_active_admins_owners_and_regular_user_when_broadcasting_then_one_per_admin_and_owner() {
        User admin = saveUser("admin-a", List.of(UserRole.ADMIN), UserStatus.ACTIVE);
        User owner = saveUser("owner-a", List.of(UserRole.OWNER), UserStatus.ACTIVE);
        saveUser("plain-user", List.of(), UserStatus.ACTIVE);

        int sent = broadcaster.broadcastToAdmins(
                userId -> notification(userId, "test-event"),
                Set.of());

        assertThat(sent).isEqualTo(2);
        List<Notification> stored = notificationRepository.findAll();
        assertThat(stored)
                .extracting(Notification::getRecipientUserId)
                .containsExactlyInAnyOrder(admin.getId(), owner.getId());
    }

    @Test
    @DisplayName("Given a deleted admin alongside an active one, when broadcasting, then only the active admin receives a notification")
    void given_deleted_admin_alongside_active_when_broadcasting_then_only_active_admin_receives() {
        saveUser("active-admin", List.of(UserRole.ADMIN), UserStatus.ACTIVE);
        saveUser("deleted-admin", List.of(UserRole.ADMIN), UserStatus.DELETED);

        int sent = broadcaster.broadcastToAdmins(
                userId -> notification(userId, "test-event"),
                Set.of());

        assertThat(sent).isEqualTo(1);
        assertThat(notificationRepository.findAll())
                .extracting(Notification::getRecipientUserId)
                .containsExactly("active-admin");
    }

    @Test
    @DisplayName("Given an exclusion set listing one admin (typically the actor), when broadcasting, then that admin is skipped while the others receive their row")
    void given_exclusion_set_with_one_admin_when_broadcasting_then_listed_admin_is_skipped() {
        saveUser("admin-1", List.of(UserRole.ADMIN), UserStatus.ACTIVE);
        saveUser("admin-2", List.of(UserRole.ADMIN), UserStatus.ACTIVE);
        saveUser("admin-3", List.of(UserRole.ADMIN), UserStatus.ACTIVE);

        int sent = broadcaster.broadcastToAdmins(
                userId -> notification(userId, "test-event"),
                Set.of("admin-2"));

        assertThat(sent).isEqualTo(2);
        assertThat(notificationRepository.findAll())
                .extracting(Notification::getRecipientUserId)
                .containsExactlyInAnyOrder("admin-1", "admin-3");
    }

    @Test
    @DisplayName("Given no admins exist in the tenant, when broadcasting, then it is a no-op — nothing is persisted and nothing throws")
    void given_no_admins_in_tenant_when_broadcasting_then_no_op() {
        saveUser("plain-user", List.of(), UserStatus.ACTIVE);

        int sent = broadcaster.broadcastToAdmins(
                userId -> notification(userId, "test-event"),
                Set.of());

        assertThat(sent).isZero();
        assertThat(notificationRepository.findAll()).isEmpty();
    }

    @Test
    @DisplayName("Given a null exclusion set, when broadcasting, then it is treated as empty and every active admin/owner receives a notification")
    void given_null_exclusion_set_when_broadcasting_then_treated_as_empty() {
        saveUser("admin-1", List.of(UserRole.ADMIN), UserStatus.ACTIVE);
        saveUser("admin-2", List.of(UserRole.ADMIN), UserStatus.ACTIVE);

        int sent = broadcaster.broadcastToAdmins(
                userId -> notification(userId, "test-event"),
                null);

        assertThat(sent).isEqualTo(2);
        assertThat(notificationRepository.findAll())
                .extracting(Notification::getRecipientUserId)
                .containsExactlyInAnyOrder("admin-1", "admin-2");
    }

    @Test
    @DisplayName("Given a factory that throws for one of the admins, when broadcasting, then the failure is logged and the other admins still get their notifications")
    void given_factory_throws_for_one_admin_when_broadcasting_then_other_admins_still_get_notifications() {
        saveUser("good-admin-1", List.of(UserRole.ADMIN), UserStatus.ACTIVE);
        saveUser("bad-admin", List.of(UserRole.ADMIN), UserStatus.ACTIVE);
        saveUser("good-admin-2", List.of(UserRole.ADMIN), UserStatus.ACTIVE);

        int sent = broadcaster.broadcastToAdmins(
                userId -> {
                    if ("bad-admin".equals(userId)) {
                        throw new RuntimeException("synthetic factory failure");
                    }
                    return notification(userId, "test-event");
                },
                Set.of());

        assertThat(sent).isEqualTo(2);
        assertThat(notificationRepository.findAll())
                .extracting(Notification::getRecipientUserId)
                .containsExactlyInAnyOrder("good-admin-1", "good-admin-2");
    }

    private User saveUser(String id, List<UserRole> roles, UserStatus status) {
        User user = User.builder()
                .id(id)
                .email(id + "@example.com")
                .firstName(id)
                .lastName("Test")
                .roles(new ArrayList<>(roles))
                .status(status)
                .build();
        return mongoTemplate.save(user);
    }

    private static Notification notification(String userId, String type) {
        return Notification.builder()
                .recipientUserId(userId)
                .title(type)
                .createdAt(Instant.now())
                .context(GenericContext.builder().type(type).payload("{}").build())
                .build();
    }
}
