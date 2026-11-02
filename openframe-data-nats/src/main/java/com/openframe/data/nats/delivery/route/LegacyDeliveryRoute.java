package com.openframe.data.nats.delivery.route;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

import static java.lang.String.format;

// the subjects the agents before the engine listen on, a JetStream stream behind each. The message is the spec's,
// the one the engine sends, without the delivery block (the field stays out of the JSON while null). A client or
// tool update is one broadcast there, the agent cannot be addressed one at a time
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class LegacyDeliveryRoute implements DeliveryRoute {

    static final int GENERATION = 0;

    private static final Map<DeliveryType, LegacySubject> SUBJECTS = Map.of(
            DeliveryType.CLIENT_UNINSTALL, LegacySubject.perMachine("machine.%s.client-uninstall"),
            DeliveryType.TOOL_INSTALLATION, LegacySubject.perMachine("machine.%s.tool-installation"),
            DeliveryType.CLIENT_UPDATE, LegacySubject.broadcast("machine.all.client-update"),
            DeliveryType.TOOL_UPDATE, LegacySubject.broadcast("machine.all.tool.%s.update"));

    private final DeliverySpecRegistry specs;
    private final NatsMessagePublisher natsMessagePublisher;

    @Override
    public Set<DeliveryType> getTypes() {
        return SUBJECTS.keySet();
    }

    @Override
    public int getGeneration() {
        return GENERATION;
    }

    @Override
    public boolean canReach(DeliveryType type, String agentVersion) {
        return !subjectOf(type).broadcast();
    }

    @Override
    public boolean canReachEveryMachine(DeliveryType type) {
        return subjectOf(type).broadcast();
    }

    @Override
    public void send(DeliverySeed seed) {
        LegacySubject legacySubject = subjectOf(seed.getType());
        String subject = legacySubject.forMachine(seed.getMachineId());
        publish(seed, subject);
    }

    @Override
    public void sendToEveryMachine(DeliverySeed seed) {
        LegacySubject legacySubject = subjectOf(seed.getType());
        String subject = legacySubject.forTarget(seed.getTargetId());
        publish(seed, subject);
    }

    private void publish(DeliverySeed seed, String subject) {
        DeliveryType type = seed.getType();
        DeliverySpec<DeliverySeed, DeliveryPayload> spec = specs.require(type);
        DeliveryRequest<DeliveryPayload> request = spec.request(seed);
        DeliveryPayload message = request.getPayload();
        natsMessagePublisher.publishPersistent(subject, message);
        log.info("Published {} on the legacy subject: subject={} targetId={}", type, subject, seed.getTargetId());
    }

    private static LegacySubject subjectOf(DeliveryType type) {
        LegacySubject subject = SUBJECTS.get(type);
        if (subject == null) {
            throw new IllegalArgumentException("No legacy subject for delivery type: " + type);
        }
        return subject;
    }

    record LegacySubject(String template, boolean broadcast) {

        static LegacySubject perMachine(String template) {
            return new LegacySubject(template, false);
        }

        static LegacySubject broadcast(String template) {
            return new LegacySubject(template, true);
        }

        String forMachine(String machineId) {
            return format(template, machineId);
        }

        String forTarget(String targetId) {
            return format(template, targetId);
        }
    }
}
