package com.openframe.management.scheduler;

import com.openframe.management.service.DebeziumService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;

@Component
@RequiredArgsConstructor
@Slf4j
public class DebeziumHealthCheckScheduler {

    private final DebeziumService debeziumService;

    @PostConstruct
    public void init() {
        log.info("DebeziumHealthCheckScheduler initialized with distributed locking");
    }

    @Scheduled(fixedDelayString = "${openframe.debezium.health-check.interval:300000}")
    @SchedulerLock(
            name = "debeziumHealthCheck",
            lockAtMostFor = "${openframe.debezium.health-check.lock-at-most-for:5m}",
            lockAtLeastFor = "${openframe.debezium.health-check.lock-at-least-for:1m}"
    )
    public void checkAndRestartFailedTasks() {
        log.debug("Checking Debezium connector health...");
        debeziumService.checkAndRestartFailedTasks();
    }
}