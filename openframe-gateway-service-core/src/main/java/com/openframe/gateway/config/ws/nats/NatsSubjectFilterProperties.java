package com.openframe.gateway.config.ws.nats;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

/**
 * Per-client allow-list for the NATS websocket routes ({@code /ws/nats}, {@code /ws/nats-api}).
 * <p>
 * Every device and every dashboard logs in to NATS as the one shared device user, so the NATS
 * permissions of that user hold a {@code *} where a machine or user id belongs and cannot tell one
 * client from another: a device may subscribe {@code machine.*.command-execution} and read every
 * machine of the tenant. The gateway does know who the client is, from the JWT it accepted on the
 * upgrade, so it vets each {@code SUB}/{@code PUB} against the patterns below with {@code {id}}
 * replaced by the caller's machine id (device token) or user id (user token), and each JetStream
 * consumer it creates against the stream's {@code StreamConsumerAuthorizer}.
 * <p>
 * Pattern tokens: a literal matches itself; {@code *} matches exactly one literal token, never a
 * wildcard sent by the client; {@code >} matches the rest of the subject, wildcards included;
 * {@code {id}} is the caller's id. The defaults are the OSS subjects only: a device's own machine
 * subjects, a user's own notifications, and the inboxes every client needs for request/reply and
 * JetStream deliveries. A product built on the gateway adds its own streams in code, through
 * {@code NatsSubjectPatternContributor} beans (the saas gateway contributes the chat stream); those
 * are always added. A list set in config replaces its default wholesale (Spring binds a list, it
 * does not merge one), so a config that touches a list has to carry every pattern of it.
 * <p>
 * Roll out in two steps: {@code enabled=true, enforce=false} logs what would be refused
 * ("NATS client ... not allowed" in the gateway log, {@code openframe.tenant.gateway.nats.command.refused}
 * counter), then {@code enforce=true}. Rollback: {@code enforce=false}.
 */
@Data
@Component
@ConfigurationProperties(prefix = "openframe.gateway.websocket.nats-subject-filter")
public class NatsSubjectFilterProperties {

    private static final long NATS_DEFAULT_MAX_PAYLOAD_BYTES = 5L * 1024 * 1024;

    /** Off by default: a pod that has not been configured relays exactly as before. */
    private boolean enabled = false;

    /** false = log what would be refused and relay it anyway; true = refuse it. */
    private boolean enforce = false;

    /** Largest {@code PUB}/{@code HPUB} payload held back for inspection; the tenant NATS refuses
     *  anything above its own {@code max_payload} (5MB in the configmap), so this only has to match it. */
    private long maxPayloadBytes = NATS_DEFAULT_MAX_PAYLOAD_BYTES;

    /** How long one command may wait for its validators (a consumer-create reads the database);
     *  past it the command is undecided: relayed while observing, refused while enforcing. */
    private Duration validationTimeout = Duration.ofSeconds(3);

    private List<String> deviceSubscribe = List.of(
            "_INBOX.*",
            "_INBOX.*.>",
            "machine.{id}.>"
    );

    private List<String> devicePublish = List.of(
            "machine.{id}.>"
    );

    private List<String> userSubscribe = List.of(
            "_INBOX.*",
            "_INBOX.*.>",
            "user.{id}.notification"
    );

    private List<String> userPublish = List.of();

    public List<String> publishPatternsFor(NatsClientKind kind) {
        return switch (kind) {
            case DEVICE -> devicePublish;
            case USER -> userPublish;
        };
    }

    public List<String> subscribePatternsFor(NatsClientKind kind) {
        return switch (kind) {
            case DEVICE -> deviceSubscribe;
            case USER -> userSubscribe;
        };
    }
}
