package com.openframe.api.service.rmm;

import com.openframe.api.service.tenant.SuperUserResolver;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestRunPolicyTest {

    private final SuperUserResolver superUserResolver = mock(SuperUserResolver.class);

    @Test
    @DisplayName("test mode on: a super user's run is a test run")
    void testModeOn_superUserRunIsATestRun() {
        when(superUserResolver.isCurrentUserSuperUser()).thenReturn(true);

        assertThat(new TestRunPolicy(true, superUserResolver).isTestRun()).isTrue();
    }

    @Test
    @DisplayName("test mode on: anyone else's run is a regular run")
    void testModeOn_regularUserRunIsNot() {
        when(superUserResolver.isCurrentUserSuperUser()).thenReturn(false);

        assertThat(new TestRunPolicy(true, superUserResolver).isTestRun()).isFalse();
    }

    @Test
    @DisplayName("test mode off: even a super user's run is a regular run")
    void testModeOff_superUserRunIsNot() {
        when(superUserResolver.isCurrentUserSuperUser()).thenReturn(true);

        assertThat(new TestRunPolicy(false, superUserResolver).isTestRun()).isFalse();
    }
}
