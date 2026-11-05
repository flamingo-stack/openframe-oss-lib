package com.openframe.management.initializer;

import com.openframe.audit.AuditCapture;
import com.openframe.core.agentkey.AgentLogKeyService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import static com.openframe.data.document.audit.AuditAction.PLATFORM_AGENT_LOG_KEY_CREATE;
import static com.openframe.data.document.audit.AuditTargetType.TENANT;

@Slf4j
@Component
@RequiredArgsConstructor
public class AgentLogKeyInitializer implements ApplicationRunner {

    private final AgentLogKeyService logKeyService;
    private final AuditCapture auditCapture;

    @Override
    public void run(ApplicationArguments args) {
        try {
            log.info("Initializing agent log key...");
            auditCapture.runWhenChanged(PLATFORM_AGENT_LOG_KEY_CREATE, TENANT, null, Map.of(), logKeyService::createIfMissing);
            log.info("Agent log key initialization completed successfully");
        } catch (Exception e) {
            // Management must keep starting: the key is re-attempted on the next start.
            log.error("Error initializing agent log key", e);
        }
    }
}
