package com.openframe.api.mapper;

import com.openframe.api.dto.notification.NotificationView;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.ReadStatus;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class GraphQLNotificationMapperTest {

    private final GraphQLNotificationMapper mapper = new GraphQLNotificationMapper();

    @ParameterizedTest
    @CsvSource({
            "UNREAD,   false",
            "READ,     true",
            "ARCHIVED, true",
            "DELETED,  false"
    })
    void toView_byReadStatus_statusExposedAndLegacyReadDerived(ReadStatus status, boolean read) {
        // setup
        Notification notification = Notification.builder().id("n-1").title("title").build();

        // execution
        NotificationView view = mapper.toView(notification, status);

        // verifications
        assertThat(view.status()).isEqualTo(status);
        assertThat(view.read()).isEqualTo(read);
    }
}
