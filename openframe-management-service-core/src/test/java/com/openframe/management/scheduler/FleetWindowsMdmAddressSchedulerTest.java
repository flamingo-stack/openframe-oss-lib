package com.openframe.management.scheduler;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.management.service.FleetWindowsMdmAddressService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetWindowsMdmAddressSchedulerTest {

    @Mock private IntegratedToolRepository toolRepository;
    @Mock private FleetWindowsMdmAddressService addressService;
    @InjectMocks private FleetWindowsMdmAddressScheduler scheduler;

    @Test
    void syncWindowsMdmAddress_handsTheFleetToolToTheService() {
        // setup
        IntegratedTool tool = new IntegratedTool();
        when(toolRepository.findByKey("fleetmdm-server")).thenReturn(Optional.of(tool));

        // execution
        scheduler.syncWindowsMdmAddress();

        // verifications
        verify(addressService).syncIfNeeded(tool);
    }

    @Test
    void syncWindowsMdmAddress_withoutTheFleetTool_doesNothing() {
        // setup
        when(toolRepository.findByKey("fleetmdm-server")).thenReturn(Optional.empty());

        // execution
        scheduler.syncWindowsMdmAddress();

        // verifications
        verifyNoInteractions(addressService);
    }

    @Test
    void syncWindowsMdmAddress_failure_staysInsideTheTick() {
        // setup
        IntegratedTool tool = new IntegratedTool();
        when(toolRepository.findByKey("fleetmdm-server")).thenReturn(Optional.of(tool));
        doThrow(new IllegalStateException("Fleet refused")).when(addressService).syncIfNeeded(tool);

        // execution / verifications
        assertThatCode(scheduler::syncWindowsMdmAddress).doesNotThrowAnyException();
        verify(addressService).syncIfNeeded(tool);
    }
}
