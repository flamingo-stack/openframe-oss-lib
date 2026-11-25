package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.nats.model.PackageAdoptMessage;
import com.openframe.data.nats.packageupdate.PackageReference;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class PackageAdoptDeliverySpecTest {

    private static final String BUNDLE_ID = "com.postmanlabs.mac";
    private static final String MACHINE_ID = "mach-42";
    private static final String REQUEST_ID = "req-1";
    private static final String DISPATCH_ID = "disp-1";
    private static final String CHOCO_FEED = "https://feed.openframe.build/choco/index.json";

    private final PackageAdoptDeliverySpec spec = new PackageAdoptDeliverySpec();
    private final JsonMapper jsonMapper = new JsonMapper();

    @Test
    void getType_packageAdopt() {
        // execution
        DeliveryType type = spec.getType();

        // verifications
        assertThat(type).isEqualTo(DeliveryType.PACKAGE_ADOPT);
    }

    @Test
    void getPayloadClass_packageAdoptMessage() {
        // execution
        Class<PackageAdoptMessage> payloadClass = spec.getPayloadClass();

        // verifications
        assertThat(payloadClass).isEqualTo(PackageAdoptMessage.class);
    }

    @Test
    void subject_machineId_machinePackageAdoptSubject() {
        // execution
        String subject = spec.subject(MACHINE_ID);

        // verifications
        assertThat(subject).isEqualTo("machine.mach-42.package-adopt");
    }

    @Test
    void getResultTimeoutSeconds_aReinstallTakesLong_halfAnHour() {
        // execution
        Long resultTimeoutSeconds = spec.getResultTimeoutSeconds();

        // verifications
        assertThat(resultTimeoutSeconds).isEqualTo(1800L);
    }

    @Test
    void canDeliverToEveryMachine_orderOfOneDevice_false() {
        // execution
        boolean everyMachine = spec.canDeliverToEveryMachine();

        // verifications
        assertThat(everyMachine).isFalse();
    }

    @Test
    void request_seed_requestIdIsTheTargetAndThePayloadCarriesThePackageAndTheBundleId() {
        // setup
        PackageReference packageRef = chocoPackage();
        PackageAdoptDeliverySeed seed = PackageAdoptDeliverySeed.builder()
                .machineId(MACHINE_ID)
                .requestId(REQUEST_ID)
                .packageRef(packageRef)
                .bundleId(BUNDLE_ID)
                .build();

        // execution
        DeliveryRequest<PackageAdoptMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getType()).isEqualTo(DeliveryType.PACKAGE_ADOPT);
        assertThat(request.getTargetId()).isEqualTo(REQUEST_ID);
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(request.getPayload())
                .extracting(PackageAdoptMessage::getRequestId, PackageAdoptMessage::getPackageRef,
                        PackageAdoptMessage::getBundleId, PackageAdoptMessage::getDelivery)
                .containsExactly(REQUEST_ID, packageRef, BUNDLE_ID, null);
    }

    @Test
    void message_brewCask_serializedAsTheAgentReadsIt() {
        // setup
        PackageReference packageRef = PackageReference.builder()
                .manager(PackageManagerType.BREW)
                .kind(BrewPackageType.CASK)
                .name("postman")
                .build();
        PackageAdoptMessage message = new PackageAdoptMessage();
        message.setDelivery(new DeliveryRef(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, DISPATCH_ID));
        message.setRequestId(REQUEST_ID);
        message.setPackageRef(packageRef);
        message.setBundleId(BUNDLE_ID);
        JsonNode expected = jsonMapper.readTree("""
                {
                  "delivery": {"type": "PACKAGE_ADOPT", "targetId": "req-1", "dispatchId": "disp-1"},
                  "requestId": "req-1",
                  "package": {"manager": "BREW", "kind": "CASK", "name": "postman"},
                  "bundleId": "com.postmanlabs.mac"
                }
                """);

        // execution
        String json = jsonMapper.writeValueAsString(message);

        // verifications
        assertThat(jsonMapper.readTree(json)).isEqualTo(expected);
    }

    @Test
    void message_chocoPackageWithoutABundleId_serializedWithTheIdAndTheFeed() {
        // setup
        PackageAdoptMessage message = new PackageAdoptMessage();
        message.setRequestId(REQUEST_ID);
        message.setPackageRef(chocoPackage());
        JsonNode expected = jsonMapper.readTree("""
                {
                  "requestId": "req-1",
                  "package": {"manager": "CHOCO", "id": "googlechrome",
                              "feed": "https://feed.openframe.build/choco/index.json"}
                }
                """);

        // execution
        String json = jsonMapper.writeValueAsString(message);

        // verifications
        assertThat(jsonMapper.readTree(json)).isEqualTo(expected);
    }

    private static PackageReference chocoPackage() {
        return PackageReference.builder()
                .manager(PackageManagerType.CHOCO)
                .id("googlechrome")
                .feed(CHOCO_FEED)
                .build();
    }
}
