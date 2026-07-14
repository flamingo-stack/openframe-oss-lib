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
import com.openframe.data.nats.push.PushSender;
import com.openframe.data.repository.push.PushDeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Delivers a notification to every device a user has registered, via FCM.
 *
 * <p>One provider covers both platforms: iOS devices hand us an FCM token too (the client uses the
 * Firebase messaging plugin), and Firebase forwards to APNs itself — so there is no per-platform
 * routing here and no APNs environment to track.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.features.push.enabled", havingValue = "true")
public class FcmPushSender implements PushSender {

    /**
     * Errors that mean the token will never work again — the app was uninstalled, the token was
     * rotated, or it belongs to another Firebase project. Anything else (UNAVAILABLE, INTERNAL,
     * QUOTA_EXCEEDED) is transient and must NOT cost the user their device registration.
     */
    private static final Set<MessagingErrorCode> DEAD_TOKEN_ERRORS = EnumSet.of(
            MessagingErrorCode.UNREGISTERED,
            MessagingErrorCode.INVALID_ARGUMENT,
            MessagingErrorCode.SENDER_ID_MISMATCH);

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
    public void sendToUser(String userId, Notification notification, NotificationCategory category) {
        List<PushDevice> devices = deviceRepository.findByUserId(userId);
        if (devices.isEmpty()) {
            log.debug("No registered devices for user {} — nothing to push", userId);
            return;
        }

        List<String> tokens = devices.stream().map(PushDevice::getToken).toList();
        MulticastMessage message = MulticastMessage.builder()
                .addAllTokens(tokens)
                .setNotification(com.google.firebase.messaging.Notification.builder()
                        .setTitle(notification.getTitle())
                        .setBody(notification.getDescription())
                        .build())
                .putAllData(buildData(notification, category))
                .build();

        BatchResponse response;
        try {
            response = firebaseMessaging.sendEachForMulticast(message);
        } catch (FirebaseMessagingException ex) {
            // The whole batch was rejected (auth, quota, provider down). The notification is already
            // persisted and already on the socket, so this is logged and dropped, never rethrown.
            log.warn("FCM multicast for notification {} to user {} failed ({}) — push dropped, in-app delivery unaffected",
                    notification.getId(), userId, ex.getMessagingErrorCode());
            return;
        }

        log.debug("Pushed notification {} to user {}: {}/{} devices delivered",
                notification.getId(), userId, response.getSuccessCount(), tokens.size());
        pruneDeadTokens(tokens, response);
    }

    /**
     * The payload is deliberately generous rather than a curated set of routing fields: the client
     * decides how to deep-link from it, so it can change its routing without a backend release.
     */
    // package-private: the payload IS the client contract, so it is asserted on directly
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
            int size = json.getBytes(StandardCharsets.UTF_8).length;
            if (size > properties.getMaxContextBytes()) {
                log.debug("Context of notification {} is {} bytes — omitted from the push payload to stay "
                        + "under the FCM size limit; the client can fetch it by id", notification.getId(), size);
                return data;
            }
            data.put(KEY_CONTEXT, json);
        } catch (JsonProcessingException ex) {
            log.warn("Could not serialize context of notification {} — pushing without it: {}",
                    notification.getId(), ex.getMessage());
        }
        return data;
    }

    private void pruneDeadTokens(List<String> tokens, BatchResponse response) {
        if (response.getFailureCount() == 0) {
            return;
        }
        List<SendResponse> responses = response.getResponses();
        List<String> dead = new ArrayList<>();
        for (int i = 0; i < responses.size() && i < tokens.size(); i++) {
            SendResponse each = responses.get(i);
            if (each.isSuccessful() || each.getException() == null) {
                continue;
            }
            MessagingErrorCode code = each.getException().getMessagingErrorCode();
            if (DEAD_TOKEN_ERRORS.contains(code)) {
                dead.add(tokens.get(i));
            } else {
                log.debug("Transient FCM error {} for one device — token kept", code);
            }
        }
        if (dead.isEmpty()) {
            return;
        }
        long removed = deviceRepository.removeTokens(dead);
        log.debug("Removed {} dead push token(s) reported by FCM", removed);
    }

    private static void putIfPresent(Map<String, String> data, String key, String value) {
        if (value != null && !value.isBlank()) {
            data.put(key, value);
        }
    }
}
