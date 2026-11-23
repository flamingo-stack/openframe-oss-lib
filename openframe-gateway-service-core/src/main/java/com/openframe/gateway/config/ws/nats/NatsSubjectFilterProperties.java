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
 * {@code {id}} is the caller's id. The defaults mirror the subjects the NATS device user is allowed
 * today, scoped to the caller. A list set in config replaces its default wholesale (Spring binds a
 * list, it does not merge one), so a config that touches a list has to carry every pattern of it.
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
            "machine.{id}.>",
            "deliver.web.{id}.>"
    );

    private List<String> devicePublish = List.of(
            "machine.{id}.>",
            "user.*.installed-agent",
            "$JS.API.CONSUMER.CREATE.MACHINE_TIMEZONE_REQUEST.*.machine.{id}.timezone.request",
            "$JS.API.CONSUMER.DELETE.MACHINE_TIMEZONE_REQUEST.>",
            "$JS.ACK.MACHINE_TIMEZONE_REQUEST.>",
            "$JS.API.STREAM.INFO.CHAT_CHUNKS",
            "$JS.API.CONSUMER.CREATE.CHAT_CHUNKS.>",
            "$JS.API.CONSUMER.INFO.CHAT_CHUNKS.>",
            "$JS.API.CONSUMER.DELETE.CHAT_CHUNKS.>",
            "$JS.API.CONSUMER.MSG.NEXT.CHAT_CHUNKS.>"
    );

    private List<String> userSubscribe = List.of(
            "_INBOX.*",
            "_INBOX.*.>",
            "deliver.web.{id}.>",
            "user.{id}.notification",
            "chat.*.message",
            "chat.*.admin-message"
    );

    private List<String> userPublish = List.of(
            "$JS.API.STREAM.INFO.CHAT_CHUNKS",
            "$JS.API.CONSUMER.CREATE.CHAT_CHUNKS.>",
            "$JS.API.CONSUMER.INFO.CHAT_CHUNKS.>",
            "$JS.API.CONSUMER.DELETE.CHAT_CHUNKS.>",
            "$JS.API.CONSUMER.MSG.NEXT.CHAT_CHUNKS.>"
    );

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
