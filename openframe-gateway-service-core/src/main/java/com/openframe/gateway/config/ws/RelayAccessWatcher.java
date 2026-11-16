package com.openframe.gateway.config.ws;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.reactive.repository.device.ReactiveMachineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.CloseStatus;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.util.context.ContextView;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;

import static com.openframe.data.document.device.DeviceStatus.ARCHIVED;
import static com.openframe.data.document.device.DeviceStatus.DELETED;
import static com.openframe.data.document.device.DeviceStatus.PENDING_DELETION;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Slf4j
@Component
@RequiredArgsConstructor
public class RelayAccessWatcher {

    static final Duration RECHECK_INTERVAL = Duration.ofMinutes(5);
    static final CloseStatus DEVICE_REMOVED = CloseStatus.POLICY_VIOLATION.withReason("device removed");

    private static final Set<DeviceStatus> REMOVED_STATUSES = EnumSet.of(PENDING_DELETION, DELETED, ARCHIVED);

    private final ReactiveMachineRepository machineRepository;

    public Disposable watch(WebSocketSession session, RelayDevice device, Instant firstCheckAt, ContextView context) {
        Duration untilFirstCheck = delayUntil(firstCheckAt);
        return Flux.interval(untilFirstCheck, RECHECK_INTERVAL)
                .concatMap(tick -> isRemoved(device).contextWrite(context))
                .filter(Boolean::booleanValue)
                .next()
                .flatMap(removed -> closeRemoved(session, device))
                .subscribe(
                        null,
                        failure -> log.error("Relay access watch failed for session {} machine {}",
                                session.getId(), device.getMachineId(), failure));
    }

    private static Duration delayUntil(Instant firstCheckAt) {
        Duration delay = Duration.between(Instant.now(), firstCheckAt);
        return delay.isNegative() ? Duration.ZERO : delay;
    }

    private Mono<Boolean> isRemoved(RelayDevice device) {
        return findMachine(device)
                .map(machine -> REMOVED_STATUSES.contains(machine.getStatus()))
                .defaultIfEmpty(true)
                .onErrorResume(failure -> {
                    log.warn("Relay access check failed for machine {}, relay kept open until the next check",
                            device.getMachineId(), failure);
                    return Mono.just(false);
                });
    }

    private Mono<Machine> findMachine(RelayDevice device) {
        if (isBlank(device.getTenantId())) {
            return machineRepository.findByMachineId(device.getMachineId());
        }
        return machineRepository.findByTenantIdAndMachineId(device.getTenantId(), device.getMachineId());
    }

    private Mono<Void> closeRemoved(WebSocketSession session, RelayDevice device) {
        log.info("Closing relay session {} of removed machine {} tenant {}",
                session.getId(), device.getMachineId(), device.getTenantId());
        return session.close(DEVICE_REMOVED);
    }
}
