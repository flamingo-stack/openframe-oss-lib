package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationContentPolicy;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.repository.Repository;

@TenantAwareRepository
public interface NotificationContentPolicyRepository
        extends Repository<NotificationContentPolicy, String>, CustomNotificationContentPolicyRepository {
}
