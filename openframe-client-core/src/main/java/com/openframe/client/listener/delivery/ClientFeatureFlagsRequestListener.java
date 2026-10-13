package com.openframe.client.listener.delivery;

import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.delivery.ClientFeatureFlagsDeliveryService;
import com.openframe.data.repository.device.MachineRepository;
import io.nats.client.Connection;
import io.nats.client.Dispatcher;
import io.nats.client.Message;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.time.Duration;

// the agent asks on every start: a machine that sat out a rollout past the reconnect window, or was reinstalled on
// the same machine id, gets the current set from here instead of waiting for the next release
@Slf4j
@Component
@RequiredArgsConstructor
public class ClientFeatureFlagsRequestListener {

    static final String SUBJECT = "machine.*.feature-flags.request";
    // a queue group: one client-service replica answers a request, not each of them
    static final String QUEUE = "client-feature-flags-request";
    private static final Duration DRAIN_TIMEOUT = Duration.ofSeconds(5);

    private final Connection natsConnection;
    private final NatsTopicMachineIdExtractor machineIdExtractor;
    private final MachineRepository machineRepository;
    private final ClientFeatureFlagsDeliveryService clientFeatureFlagsDeliveryService;

    private Dispatcher dispatcher;

    @EventListener(ApplicationReadyEvent.class)
    public void subscribe() {
        dispatcher = natsConnection.createDispatcher();
        dispatcher.subscribe(SUBJECT, QUEUE, this::handleMessage);
        log.info("Subscribed to client feature flags requests: subject={}", SUBJECT);
    }

    void handleMessage(Message message) {
        String subject = message.getSubject();
        try {
            String machineId = machineIdExtractor.extract(subject);
            requireKnownMachine(machineId);
            log.info("Machine asks for its client feature flags: machineId={}", machineId);
            clientFeatureFlagsDeliveryService.process(machineId);
        } catch (Exception e) {
            log.error("Client feature flags request dropped: subject={}", subject, e);
        }
    }

    private void requireKnownMachine(String machineId) {
        if (!machineRepository.existsByMachineId(machineId)) {
            throw new MachineNotFoundException(machineId);
        }
    }

    @PreDestroy
    public void cleanup() {
        if (dispatcher == null) {
            return;
        }
        try {
            dispatcher.drain(DRAIN_TIMEOUT);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Interrupted while draining the client feature flags request dispatcher");
        }
    }
}
