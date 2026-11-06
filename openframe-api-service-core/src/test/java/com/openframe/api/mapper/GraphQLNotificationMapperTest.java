package com.openframe.api.mapper;

import com.openframe.api.dto.notification.NotificationView;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.ReadStatus;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;

class GraphQLNotificationMapperTest {

    private final GraphQLNotificationMapper mapper = new GraphQLNotificationMapper();

    @ParameterizedTest
    @EnumSource(ReadStatus.class)
    void toView_byReadStatus_statusExposed(ReadStatus status) {
        // setup
        Notification notification = Notification.builder().id("n-1").title("title").build();

        // execution
        NotificationView view = mapper.toView(notification, status);

        // verifications
        assertThat(view.status()).isEqualTo(status);
    }
}
