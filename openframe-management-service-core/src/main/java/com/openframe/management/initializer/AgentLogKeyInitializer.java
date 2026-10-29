package com.openframe.management.initializer;

import com.openframe.core.agentkey.AgentLogKeyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AgentLogKeyInitializer implements ApplicationRunner {

    private final AgentLogKeyService logKeyService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            log.info("Initializing agent log key...");
            logKeyService.createIfMissing();
            log.info("Agent log key initialization completed successfully");
        } catch (Exception e) {
            // Management must keep starting: the key is re-attempted on the next start.
            log.error("Error initializing agent log key", e);
        }
    }
}
