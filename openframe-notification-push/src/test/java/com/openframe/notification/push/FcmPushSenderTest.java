package com.openframe.notification.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.SendResponse;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.data.document.push.PushDevice;
import com.openframe.data.document.push.PushPlatform;
import com.openframe.data.repository.push.PushDeviceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class FcmPushSenderTest {

    private FirebaseMessaging firebaseMessaging;
    private PushDeviceRepository deviceRepository;
    private FcmProperties properties;
    private FcmPushSender sender;

    @BeforeEach
    void setUp() {
        firebaseMessaging = mock(FirebaseMessaging.class);
        deviceRepository = mock(PushDeviceRepository.class);
        properties = new FcmProperties();
        properties.setProjectId("flamingo-271f8");
        sender = new FcmPushSender(firebaseMessaging, deviceRepository, new ObjectMapper(), properties);
    }

    @Test
    @DisplayName("Given a user with no registered devices, when sendToUser is called, then FCM is never called — an account with no phone is a no-op, not an error")
    void user_without_devices_is_a_noop() throws Exception {
        when(deviceRepository.findByUserId("u1")).thenReturn(List.of());

        sender.sendToUser("u1", notification(), NotificationCategory.TICKETS);

        verifyNoInteractions(firebaseMessaging);
    }

    @Test
    @DisplayName("Given a user with several devices, when sendToUser is called, then a single multicast is sent rather than one call per device")
    void devices_are_multicast_in_one_call() throws Exception {
        when(deviceRepository.findByUserId("u1")).thenReturn(List.of(device("tok-a"), device("tok-b")));
        BatchResponse allDelivered = batch(0, List.of(success(), success()));
        when(firebaseMessaging.sendEachForMulticast(any())).thenReturn(allDelivered);

        sender.sendToUser("u1", notification(), NotificationCategory.TICKETS);

        verify(firebaseMessaging).sendEachForMulticast(any(MulticastMessage.class));
        verify(deviceRepository, never()).removeTokens(anyCollection());
    }

    @Test
    @DisplayName("Given a notification, when the data payload is built, then it carries id/type/category/severity AND the whole serialized context — the client routes off this, so it can change deep-linking without a backend release")
    void data_payload_carries_the_whole_context_so_the_client_owns_routing() {
        Map<String, String> data = sender.buildData(notification(), NotificationCategory.TICKETS);

        assertThat(data).containsEntry("notificationId", "notif-1")
                .containsEntry("type", "TICKET_ASSIGNED")
                .containsEntry("category", "TICKETS")
                .containsEntry("severity", "INFO");
        assertThat(data.get("context")).contains("TICKET_ASSIGNED");
    }

    @Test
    @DisplayName("Given a context larger than the configured cap, when the data payload is built, then the context is dropped but the ids survive — FCM rejects oversized messages, so a fat context must cost the context, not the whole push")
    void oversized_context_is_dropped_but_the_push_still_goes() {
        properties.setMaxContextBytes(10);

        Map<String, String> data = sender.buildData(notification(), NotificationCategory.TICKETS);

        assertThat(data).doesNotContainKey("context");
        assertThat(data).containsEntry("notificationId", "notif-1")
                .containsEntry("type", "TICKET_ASSIGNED");
    }

    @Test
    @DisplayName("Given a user whose dead tokens piled up past FCM's 500-token multicast cap, when sendToUser is called, then the tokens are chunked rather than truncated — MulticastMessage.build() throws above 500, before anything is sent, which would strand the user forever since pruning only runs after a send")
    void tokens_beyond_the_multicast_cap_are_chunked_not_dropped() throws Exception {
        List<PushDevice> devices = IntStream.range(0, 501).mapToObj(i -> device("tok-" + i)).toList();
        when(deviceRepository.findByUserId("u1")).thenReturn(devices);
        BatchResponse ok = batch(0, List.of(success()));
        when(firebaseMessaging.sendEachForMulticast(any())).thenReturn(ok);

        assertThatCode(() -> sender.sendToUser("u1", notification(), NotificationCategory.TICKETS))
                .doesNotThrowAnyException();

        verify(firebaseMessaging, times(2)).sendEachForMulticast(any(MulticastMessage.class));
    }

    @Test
    @DisplayName("Given FCM reports a token as UNREGISTERED, when sendToUser is called, then exactly that token is deleted — the app was uninstalled and the row is now garbage")
    void unregistered_token_is_pruned() throws Exception {
        when(deviceRepository.findByUserId("u1")).thenReturn(List.of(device("dead"), device("alive")));
        BatchResponse oneDead = batch(1, List.of(failure(MessagingErrorCode.UNREGISTERED), success()));
        when(firebaseMessaging.sendEachForMulticast(any())).thenReturn(oneDead);

        sender.sendToUser("u1", notification(), NotificationCategory.TICKETS);

        ArgumentCaptor<List<String>> captor = ArgumentCaptor.forClass(List.class);
        verify(deviceRepository).removeTokens(captor.capture());
        assertThat(captor.getValue()).containsExactly("dead");
    }

    @Test
    @DisplayName("Given FCM reports a transient UNAVAILABLE for a device, when sendToUser is called, then the token is KEPT — a provider hiccup must not cost the user their device registration")
    void transient_error_does_not_prune_the_token() throws Exception {
        when(deviceRepository.findByUserId("u1")).thenReturn(List.of(device("tok-a")));
        BatchResponse transientFailure = batch(1, List.of(failure(MessagingErrorCode.UNAVAILABLE)));
        when(firebaseMessaging.sendEachForMulticast(any())).thenReturn(transientFailure);

        sender.sendToUser("u1", notification(), NotificationCategory.TICKETS);

        verify(deviceRepository, never()).removeTokens(anyCollection());
    }

    @Test
    @DisplayName("Given FCM rejects the whole batch (provider down / auth), when sendToUser is called, then the exception is swallowed and no token is pruned — the notification is already persisted and already on the socket")
    void whole_batch_failure_is_swallowed_and_prunes_nothing() throws Exception {
        when(deviceRepository.findByUserId("u1")).thenReturn(List.of(device("tok-a")));
        FirebaseMessagingException ex = mock(FirebaseMessagingException.class);
        when(ex.getMessagingErrorCode()).thenReturn(MessagingErrorCode.UNAVAILABLE);
        when(firebaseMessaging.sendEachForMulticast(any())).thenThrow(ex);

        assertThatCode(() -> sender.sendToUser("u1", notification(), NotificationCategory.TICKETS))
                .doesNotThrowAnyException();

        verify(deviceRepository, never()).removeTokens(anyCollection());
    }

    private static Notification notification() {
        return Notification.builder()
                .id("notif-1")
                .title("TKT-42 - Printer on fire")
                .description("Assigned to Alice by Bob")
                .severity(NotificationSeverity.INFO)
                .context(GenericContext.builder().type("TICKET_ASSIGNED").payload("{}").build())
                .build();
    }

    private static PushDevice device(String token) {
        return PushDevice.builder().token(token).userId("u1").platform(PushPlatform.ANDROID).build();
    }

    private static BatchResponse batch(int failureCount, List<SendResponse> responses) {
        BatchResponse batch = mock(BatchResponse.class);
        when(batch.getFailureCount()).thenReturn(failureCount);
        when(batch.getSuccessCount()).thenReturn(responses.size() - failureCount);
        when(batch.getResponses()).thenReturn(responses);
        return batch;
    }

    private static SendResponse success() {
        SendResponse response = mock(SendResponse.class);
        when(response.isSuccessful()).thenReturn(true);
        return response;
    }

    private static SendResponse failure(MessagingErrorCode code) {
        FirebaseMessagingException ex = mock(FirebaseMessagingException.class);
        when(ex.getMessagingErrorCode()).thenReturn(code);
        SendResponse response = mock(SendResponse.class);
        when(response.isSuccessful()).thenReturn(false);
        when(response.getException()).thenReturn(ex);
        return response;
    }
}
