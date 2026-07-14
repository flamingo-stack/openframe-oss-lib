package com.openframe.notification.push;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.SendResponse;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.push.PushDevice;
import com.openframe.data.nats.channel.NotificationChannel;
import com.openframe.data.repository.push.PushDeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * One provider covers both platforms: the client uses the Firebase messaging plugin, so iOS hands us
 * an FCM token too and Firebase forwards to APNs itself — no per-platform routing, no APNs environment.
 */
@Slf4j
@RequiredArgsConstructor
public class FcmPushSender implements NotificationChannel {

    /**
     * Errors that can ONLY mean the token is dead.
     *
     * <p>INVALID_ARGUMENT is deliberately absent: FCM maps every HTTP 400 to it, including a malformed
     * or oversized PAYLOAD — which fails for every token in the batch. Treating it as a dead token
     * would let one bad message delete every device a user owns. Payload size is bounded instead
     * (see FcmProperties), and a token that is merely invalid stops working on its own.
     */
    private static final Set<MessagingErrorCode> DEAD_TOKEN_ERRORS = EnumSet.of(
            MessagingErrorCode.UNREGISTERED,
            MessagingErrorCode.SENDER_ID_MISMATCH);

    /**
     * MulticastMessage.build() throws above this, before anything is sent — which would strand a user
     * whose dead tokens piled up, since pruning only runs after a send. Chunk, never truncate.
     */
    private static final int MAX_TOKENS_PER_MULTICAST = 500;

    private static final String KEY_NOTIFICATION_ID = "notificationId";
    private static final String KEY_TYPE = "type";
    private static final String KEY_CATEGORY = "category";
    private static final String KEY_SEVERITY = "severity";
    private static final String KEY_CONTEXT = "context";

    private final FirebaseMessaging firebaseMessaging;
    private final PushDeviceRepository deviceRepository;
    private final ObjectMapper objectMapper;
    private final FcmProperties properties;

    @Override
    public String name() {
        return "fcm";
    }

    @Override
    public void deliver(String userId, Notification notification, NotificationCategory category) {
        List<PushDevice> devices = deviceRepository.findByUserId(userId);
        if (devices.isEmpty()) {
            return;
        }

        List<String> tokens = devices.stream().map(PushDevice::getToken).toList();
        Map<String, String> data = buildData(notification, category);
        List<String> dead = new ArrayList<>();

        for (int from = 0; from < tokens.size(); from += MAX_TOKENS_PER_MULTICAST) {
            List<String> chunk = tokens.subList(from, Math.min(from + MAX_TOKENS_PER_MULTICAST, tokens.size()));
            sendChunk(userId, notification, data, chunk, dead);
        }

        if (!dead.isEmpty()) {
            log.debug("Removed {} dead push token(s) reported by FCM", deviceRepository.removeTokens(dead));
        }
    }

    private void sendChunk(String userId, Notification notification, Map<String, String> data,
                           List<String> tokens, List<String> dead) {
        MulticastMessage message = MulticastMessage.builder()
                .addAllTokens(tokens)
                .setNotification(com.google.firebase.messaging.Notification.builder()
                        .setTitle(truncateToBytes(notification.getTitle(), properties.getMaxTitleBytes()))
                        .setBody(truncateToBytes(notification.getDescription(), properties.getMaxBodyBytes()))
                        .build())
                .putAllData(data)
                .build();

        BatchResponse response;
        try {
            response = firebaseMessaging.sendEachForMulticast(message);
        } catch (FirebaseMessagingException ex) {
            // Already persisted and already on the socket — a dead provider is logged, never rethrown.
            log.warn("FCM multicast for notification {} to user {} failed ({}) — push dropped, in-app delivery unaffected",
                    notification.getId(), userId, ex.getMessagingErrorCode());
            return;
        }

        log.debug("Pushed notification {} to user {}: {}/{} devices delivered",
                notification.getId(), userId, response.getSuccessCount(), tokens.size());
        collectDeadTokens(tokens, response, dead);
    }

    /** Carries the whole context, not curated routing fields, so the client can change deep-linking without a backend release. */
    // package-private: the payload is the client contract
    Map<String, String> buildData(Notification notification, NotificationCategory category) {
        Map<String, String> data = new HashMap<>();
        putIfPresent(data, KEY_NOTIFICATION_ID, notification.getId());
        putIfPresent(data, KEY_CATEGORY, category == null ? null : category.name());
        putIfPresent(data, KEY_SEVERITY,
                notification.getSeverity() == null ? null : notification.getSeverity().name());

        NotificationContext context = notification.getContext();
        if (context == null) {
            return data;
        }
        putIfPresent(data, KEY_TYPE, context.getType());

        try {
            String json = objectMapper.writeValueAsString(context);
            if (json.getBytes(StandardCharsets.UTF_8).length > properties.getMaxContextBytes()) {
                log.debug("Context of notification {} too large for the push payload — omitted; "
                        + "the client can fetch it by id", notification.getId());
                return data;
            }
            data.put(KEY_CONTEXT, json);
        } catch (JsonProcessingException ex) {
            log.warn("Could not serialize context of notification {} — pushing without it: {}",
                    notification.getId(), ex.getMessage());
        }
        return data;
    }

    private static void collectDeadTokens(List<String> tokens, BatchResponse response, List<String> dead) {
        if (response.getFailureCount() == 0) {
            return;
        }
        List<SendResponse> responses = response.getResponses();
        for (int i = 0; i < responses.size() && i < tokens.size(); i++) {
            SendResponse each = responses.get(i);
            if (each.isSuccessful() || each.getException() == null) {
                continue;
            }
            if (DEAD_TOKEN_ERRORS.contains(each.getException().getMessagingErrorCode())) {
                dead.add(tokens.get(i));
            }
        }
    }

    /** Cuts on a code-point boundary — slicing a multi-byte character in half would corrupt the text. */
    private static String truncateToBytes(String value, int maxBytes) {
        if (value == null || value.getBytes(StandardCharsets.UTF_8).length <= maxBytes) {
            return value;
        }
        StringBuilder kept = new StringBuilder();
        int used = 0;
        for (int i = 0; i < value.length(); ) {
            int codePoint = value.codePointAt(i);
            int cost = new String(Character.toChars(codePoint)).getBytes(StandardCharsets.UTF_8).length;
            if (used + cost > maxBytes) {
                break;
            }
            kept.appendCodePoint(codePoint);
            used += cost;
            i += Character.charCount(codePoint);
        }
        return kept.toString();
    }

    private static void putIfPresent(Map<String, String> data, String key, String value) {
        if (value != null && !value.isBlank()) {
            data.put(key, value);
        }
    }
}
