package com.openframe.api.service.rmm;

import com.openframe.api.service.tenant.SuperUserResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class TestRunPolicy {

    private final boolean testModeEnabled;
    private final SuperUserResolver superUserResolver;

    public TestRunPolicy(@Value("${openframe.rmm.test-run.enabled:false}") boolean testModeEnabled,
                         SuperUserResolver superUserResolver) {
        this.testModeEnabled = testModeEnabled;
        this.superUserResolver = superUserResolver;
    }

    public boolean isTestRun() {
        return testModeEnabled && superUserResolver.isCurrentUserSuperUser();
    }
}
