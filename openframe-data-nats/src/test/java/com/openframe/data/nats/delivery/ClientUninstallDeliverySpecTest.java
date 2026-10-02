package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.model.ClientUninstallMessage;
import com.openframe.delivery.spec.DeliveryRequest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ClientUninstallDeliverySpecTest {

    private static final String MACHINE_ID = "mach-42";

    private final ClientUninstallDeliverySpec spec = new ClientUninstallDeliverySpec();

    @Test
    void request_seed_messageStampedAndTargetIsTheClient() {
        // setup
        ClientUninstallDeliverySeed seed = new ClientUninstallDeliverySeed(MACHINE_ID);

        // execution
        DeliveryRequest<ClientUninstallMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getType()).isEqualTo(DeliveryType.CLIENT_UNINSTALL);
        assertThat(request.getTargetId()).isEqualTo("openframe-client");
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(request.getPayload().getIssuedAt()).isNotBlank();
        assertThat(request.getPayload().getDelivery()).isNull();
    }

    @Test
    void subject_machineId_machineClientUninstallSubject() {
        // execution
        String subject = spec.subject(MACHINE_ID);

        // verifications
        assertThat(subject).isEqualTo("machine.mach-42.client-uninstall");
    }
}
