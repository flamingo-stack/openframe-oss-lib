package com.openframe.client.listener;

import com.openframe.client.service.ToolOsSupportReconciler;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.track.DeliveryDoneEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ToolUninstallDoneListenerTest {

    private static final String MACHINE_ID = "m-1";
    private static final String TOOL_AGENT_ID = "fleetmdm-agent";

    @Mock private ToolOsSupportReconciler toolOsSupportReconciler;

    @InjectMocks private ToolUninstallDoneListener listener;

    @Test
    void onDeliveryDone_toolUninstall_uninstallCompletedForTheMachineAndAgent() {
        // setup
        DeliveryDoneEvent event = new DeliveryDoneEvent(DeliveryType.TOOL_UNINSTALL, TOOL_AGENT_ID, MACHINE_ID);

        // execution
        listener.onDeliveryDone(event);

        // verifications
        verify(toolOsSupportReconciler).completeUninstall(MACHINE_ID, TOOL_AGENT_ID);
    }

    @ParameterizedTest
    @EnumSource(value = DeliveryType.class, mode = EnumSource.Mode.EXCLUDE, names = "TOOL_UNINSTALL")
    void onDeliveryDone_otherDeliveryType_ignored(DeliveryType type) {
        // setup
        DeliveryDoneEvent event = new DeliveryDoneEvent(type, TOOL_AGENT_ID, MACHINE_ID);

        // execution
        listener.onDeliveryDone(event);

        // verifications
        verifyNoInteractions(toolOsSupportReconciler);
    }

    @Test
    void onDeliveryDone_completeUninstallThrows_swallowedWithoutThrowing() {
        // setup
        DeliveryDoneEvent event = new DeliveryDoneEvent(DeliveryType.TOOL_UNINSTALL, TOOL_AGENT_ID, MACHINE_ID);
        doThrow(new IllegalStateException("mongo down")).when(toolOsSupportReconciler).completeUninstall(MACHINE_ID, TOOL_AGENT_ID);

        // execution
        assertThatCode(() -> listener.onDeliveryDone(event)).doesNotThrowAnyException();

        // verifications
        verify(toolOsSupportReconciler).completeUninstall(MACHINE_ID, TOOL_AGENT_ID);
    }
}
