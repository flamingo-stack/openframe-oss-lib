package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminNotificationBroadcaster {

    private static final Collection<UserRole> ADMIN_ROLES = List.of(UserRole.ADMIN, UserRole.OWNER);

    private final UserRepository userRepository;
    private final NotificationPublishingService notificationPublishingService;

    public int broadcastToAdmins(Function<String, ? extends Notification> recipientFactory,
                                 Set<String> excludeUserIds) {
        Set<String> exclusions = excludeUserIds == null ? Set.of() : excludeUserIds;

        List<User> admins = userRepository.findByRolesInAndStatus(ADMIN_ROLES, UserStatus.ACTIVE);
        if (admins.isEmpty()) {
            return 0;
        }

        int sent = 0;
        for (User admin : admins) {
            String userId = admin.getId();
            if (exclusions.contains(userId)) {
                continue;
            }
            try {
                notificationPublishingService.create(recipientFactory.apply(userId));
                sent++;
            } catch (Exception ex) {

                log.warn("Failed to broadcast notification to admin {}: {}", userId, ex.getMessage());
            }
        }
        return sent;
    }
}
