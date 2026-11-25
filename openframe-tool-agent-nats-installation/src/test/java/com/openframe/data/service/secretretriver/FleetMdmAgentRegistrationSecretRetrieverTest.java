package com.openframe.data.service.secretretriver;

import com.openframe.core.exception.InternalException;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.data.service.ToolUrlService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmAgentRegistrationSecretRetrieverTest {

    @Mock private IntegratedToolService integratedToolService;
    @Mock private ToolUrlService toolUrlService;
    @InjectMocks private FleetMdmAgentRegistrationSecretRetriever retriever;

    @Test
    void getSecret_fleetToolRecordMissing_failsAsAnInternalError() {
        when(integratedToolService.getToolByKey("fleetmdm-server")).thenReturn(Optional.empty());

        assertThatThrownBy(retriever::getSecret)
                .isInstanceOf(InternalException.class)
                .hasMessage("Failed to retrieve Fleet MDM enroll secret")
                .hasCauseInstanceOf(IllegalStateException.class);
    }
}
