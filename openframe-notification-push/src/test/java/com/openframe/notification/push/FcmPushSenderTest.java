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
    @DisplayName("Given a user with no registered devices, when the channel delivers, then FCM is never called — an account with no phone is a no-op, not an error")
    void user_without_devices_is_a_noop() {
        when(deviceRepository.findByUserId("u1")).thenReturn(List.of());

        sender.deliver("u1", notification(), NotificationCategory.TICKETS);

        verifyNoInteractions(firebaseMessaging);
    }

    @Test
    @DisplayName("Given a user with several devices, when the channel delivers, then a single multicast is sent rather than one call per device")
    void devices_are_multicast_in_one_call() throws Exception {
        when(deviceRepository.findByUserId("u1")).thenReturn(List.of(device("tok-a"), device("tok-b")));
        BatchResponse allDelivered = batch(0, List.of(success(), success()));
        when(firebaseMessaging.sendEachForMulticast(any())).thenReturn(allDelivered);

        sender.deliver("u1", notification(), NotificationCategory.TICKETS);

        verify(firebaseMessaging).sendEachForMulticast(any(MulticastMessage.class));
        verify(deviceRepository, never()).removeTokens(anyCollection());
    }

    @Test
    @DisplayName("Given FCM reports a token as UNREGISTERED, when the channel delivers, then exactly that token is deleted — the app was uninstalled and the row is now garbage")
    void unregistered_token_is_pruned() throws Exception {
        when(deviceRepository.findByUserId("u1")).thenReturn(List.of(device("dead"), device("alive")));
        BatchResponse oneDead = batch(1, List.of(failure(MessagingErrorCode.UNREGISTERED), success()));
        when(firebaseMessaging.sendEachForMulticast(any())).thenReturn(oneDead);

        sender.deliver("u1", notification(), NotificationCategory.TICKETS);

        ArgumentCaptor<List<String>> captor = ArgumentCaptor.forClass(List.class);
        verify(deviceRepository).removeTokens(captor.capture());
        assertThat(captor.getValue()).containsExactly("dead");
    }

    @Test
    @DisplayName("Given FCM answers INVALID_ARGUMENT for every device, when the channel delivers, then NO token is deleted — INVALID_ARGUMENT is FCM's mapping for any HTTP 400 including a bad payload, so treating it as a dead token would let one malformed message wipe out every device a user owns")
    void invalid_argument_never_prunes_tokens() throws Exception {
        when(deviceRepository.findByUserId("u1"))
                .thenReturn(List.of(device("tok-a"), device("tok-b"), device("tok-c")));
        BatchResponse allRejected = batch(3, List.of(
                failure(MessagingErrorCode.INVALID_ARGUMENT),
                failure(MessagingErrorCode.INVALID_ARGUMENT),
                failure(MessagingErrorCode.INVALID_ARGUMENT)));
        when(firebaseMessaging.sendEachForMulticast(any())).thenReturn(allRejected);

        sender.deliver("u1", notification(), NotificationCategory.TICKETS);

        verify(deviceRepository, never()).removeTokens(anyCollection());
    }

    @Test
    @DisplayName("Given FCM reports a transient UNAVAILABLE for a device, when the channel delivers, then the token is KEPT — a provider hiccup must not cost the user their device registration")
    void transient_error_does_not_prune_the_token() throws Exception {
        when(deviceRepository.findByUserId("u1")).thenReturn(List.of(device("tok-a")));
        BatchResponse transientFailure = batch(1, List.of(failure(MessagingErrorCode.UNAVAILABLE)));
        when(firebaseMessaging.sendEachForMulticast(any())).thenReturn(transientFailure);

        sender.deliver("u1", notification(), NotificationCategory.TICKETS);

        verify(deviceRepository, never()).removeTokens(anyCollection());
    }

    @Test
    @DisplayName("Given a user whose dead tokens piled up past FCM's 500-token multicast cap, when the channel delivers, then the tokens are chunked AND a dead token in a later chunk is matched to the right token — MulticastMessage.build() throws above 500 before anything is sent, and a per-chunk index slip would prune the wrong device")
    void tokens_beyond_the_cap_are_chunked_and_dead_tokens_map_to_the_right_chunk() throws Exception {
        List<PushDevice> devices = IntStream.range(0, 501).mapToObj(i -> device("tok-" + i)).toList();
        when(deviceRepository.findByUserId("u1")).thenReturn(devices);

        BatchResponse firstChunkOk = batch(0, IntStream.range(0, 500).mapToObj(i -> success()).toList());
        BatchResponse secondChunkDead = batch(1, List.of(failure(MessagingErrorCode.UNREGISTERED)));
        when(firebaseMessaging.sendEachForMulticast(any()))
                .thenReturn(firstChunkOk)
                .thenReturn(secondChunkDead);

        sender.deliver("u1", notification(), NotificationCategory.TICKETS);

        verify(firebaseMessaging, times(2)).sendEachForMulticast(any(MulticastMessage.class));
        ArgumentCaptor<List<String>> captor = ArgumentCaptor.forClass(List.class);
        verify(deviceRepository).removeTokens(captor.capture());
        assertThat(captor.getValue()).containsExactly("tok-500");
    }

    @Test
    @DisplayName("Given FCM rejects the whole batch (provider down / auth), when the channel delivers, then the exception is swallowed and no token is pruned — the notification is already persisted and already on the socket")
    void whole_batch_failure_is_swallowed_and_prunes_nothing() throws Exception {
        when(deviceRepository.findByUserId("u1")).thenReturn(List.of(device("tok-a")));
        FirebaseMessagingException ex = mock(FirebaseMessagingException.class);
        when(ex.getMessagingErrorCode()).thenReturn(MessagingErrorCode.UNAVAILABLE);
        when(firebaseMessaging.sendEachForMulticast(any())).thenThrow(ex);

        assertThatCode(() -> sender.deliver("u1", notification(), NotificationCategory.TICKETS))
                .doesNotThrowAnyException();

        verify(deviceRepository, never()).removeTokens(anyCollection());
    }

    @Test
    @DisplayName("Given a notification, when the data payload is built, then it carries id/type/category/severity AND the context's own fields — the client routes off this, so it can change deep-linking without a backend release")
    void data_payload_carries_the_context_fields_the_client_routes_on() {
        Map<String, String> data = sender.buildData(notification(), NotificationCategory.TICKETS);

        assertThat(data).containsEntry("notificationId", "notif-1")
                .containsEntry("type", "TICKET_ASSIGNED")
                .containsEntry("category", "TICKETS")
                .containsEntry("severity", "INFO");
        assertThat(data.get("context")).contains("\"payload\"").contains("ticket-77");
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

    private static Notification notification() {
        return Notification.builder()
                .id("notif-1")
                .title("TKT-42 - Printer on fire")
                .description("Assigned to Alice by Bob")
                .severity(NotificationSeverity.INFO)
                .context(GenericContext.builder().type("TICKET_ASSIGNED").payload("{\"ticketId\":\"ticket-77\"}").build())
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
