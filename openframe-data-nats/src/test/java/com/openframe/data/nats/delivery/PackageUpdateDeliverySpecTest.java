package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.nats.packageupdate.PackageReference;
import com.openframe.data.nats.packageupdate.PackageUpdateMessage;
import com.openframe.data.nats.packageupdate.UpdateMode;
import com.openframe.data.nats.packageupdate.UpdateSource;
import com.openframe.delivery.spec.DeliveryRequest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PackageUpdateDeliverySpecTest {

    private final PackageUpdateDeliverySpec spec = new PackageUpdateDeliverySpec();

    @Test
    void type_payload_subject() {
        assertThat(spec.getType()).isEqualTo(DeliveryType.PACKAGE_UPDATE);
        assertThat(spec.getPayloadClass()).isEqualTo(PackageUpdateMessage.class);
        assertThat(spec.subject("m-1")).isEqualTo("machine.m-1.package-update");
        assertThat(spec.canDeliverToEveryMachine()).isFalse();   // one order per device and request
    }

    @Test
    void request_mapsSeedOntoPayload_targetIdIsRequestId() {
        PackageUpdateDeliverySeed seed = PackageUpdateDeliverySeed.builder()
                .machineId("m-1")
                .requestId("req-1")
                .source(UpdateSource.builder()
                        .kind(UpdateSource.Kind.MANUAL).origin(UpdateSource.Origin.ADMIN).build())
                .packageRef(PackageReference.builder()
                        .manager(PackageManagerType.WINGET).id("Google.Chrome").build())
                .mode(UpdateMode.FORCE)
                .countdownSeconds(300)
                .build();

        DeliveryRequest<PackageUpdateMessage> request = spec.request(seed);

        assertThat(request.getType()).isEqualTo(DeliveryType.PACKAGE_UPDATE);
        assertThat(request.getTargetId()).isEqualTo("req-1");       // == requestId
        assertThat(request.getMachineId()).isEqualTo("m-1");
        PackageUpdateMessage payload = request.getPayload();
        assertThat(payload.getRequestId()).isEqualTo("req-1");
        assertThat(payload.getMode()).isEqualTo(UpdateMode.FORCE);
        assertThat(payload.getCountdownSeconds()).isEqualTo(300);
        assertThat(payload.getSource().getKind()).isEqualTo(UpdateSource.Kind.MANUAL);
        assertThat(payload.getPackageRef().getId()).isEqualTo("Google.Chrome");
        assertThat(payload.getDelivery()).isNull();                 // the engine stamps the envelope, not the spec
    }
}
