package com.openframe.api.datafetcher;

import com.openframe.api.mapper.GraphQLNotificationMapper;
import com.openframe.graphql.relay.InvalidRelayIdException;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.api.service.NotificationService;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.notification.readstate.NotificationReadStateService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class NotificationDataFetcherRelayIdTest {

    private static final String USER_ID = "user-1";
    private static final String RAW_NOTIFICATION_ID = "notification-1";
    private static final String NOTIFICATION_GLOBAL_ID = "Tm90aWZpY2F0aW9uOm5vdGlmaWNhdGlvbi0x";

    @Mock private NotificationService notificationService;
    @Mock private NotificationReadStateService readStateService;
    @Mock private GraphQLNotificationMapper notificationMapper;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private NotificationDataFetcher dataFetcher;

    private final RelayIdCodec codec = new RelayIdCodec();

    @BeforeEach
    void signIn() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", USER_ID)
                .build();
        JwtAuthenticationToken authentication = new JwtAuthenticationToken(jwt, AuthorityUtils.NO_AUTHORITIES);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void markNotificationAsRead_notificationGlobalId_marksRawId() {
        // execution
        dataFetcher.markNotificationAsRead(NOTIFICATION_GLOBAL_ID);

        // verifications
        verify(readStateService).markRead(USER_ID, RecipientType.USER, RAW_NOTIFICATION_ID);
    }

    @Test
    void markNotificationAsRead_rawId_marksRawIdUnchanged() {
        // execution
        dataFetcher.markNotificationAsRead(RAW_NOTIFICATION_ID);

        // verifications
        verify(readStateService).markRead(USER_ID, RecipientType.USER, RAW_NOTIFICATION_ID);
    }

    @Test
    void markNotificationAsRead_globalIdOfAnotherType_throwsInvalidRelayId() {
        // setup
        String tagId = codec.encode(NodeType.TAG, RAW_NOTIFICATION_ID);

        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> dataFetcher.markNotificationAsRead(tagId));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Expected a Notification id, got Tag");
        verifyNoInteractions(readStateService);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void markNotificationAsRead_blankId_throwsIllegalArgument(String notificationId) {
        // execution
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> dataFetcher.markNotificationAsRead(notificationId));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("notificationId must not be blank");
        verifyNoInteractions(readStateService);
    }

    @Test
    void deleteNotification_notificationGlobalId_deletesRawId() {
        // execution
        dataFetcher.deleteNotification(NOTIFICATION_GLOBAL_ID);

        // verifications
        verify(readStateService).deleteNotification(USER_ID, RecipientType.USER, RAW_NOTIFICATION_ID);
    }
}
