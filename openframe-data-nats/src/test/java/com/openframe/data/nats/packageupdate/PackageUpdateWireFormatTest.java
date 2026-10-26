package com.openframe.data.nats.packageupdate;

import com.openframe.data.document.rmm.software.PackageUpdateMode;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.delivery.spec.DeliveryRef;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class PackageUpdateWireFormatTest {

    private final JsonMapper mapper = new JsonMapper();

    @Test
    void order_serializesToContractShape_wingetForce() {
        PackageUpdateMessage order = new PackageUpdateMessage();
        order.setDelivery(new DeliveryRef(DeliveryType.PACKAGE_UPDATE, "req-1", "disp-1"));
        order.getDelivery().setSequence(43);
        order.setRequestId("req-1");
        order.setSource(UpdateSource.builder()
                .kind(UpdateSource.Kind.MANUAL).origin(UpdateSource.Origin.ADMIN).build());
        order.setPackageRef(PackageReference.builder()
                .manager(PackageManagerType.WINGET).id("Google.Chrome").build());
        order.setMode(PackageUpdateMode.FORCE);
        order.setCountdownSeconds(300);

        JsonNode json = mapper.readTree(mapper.writeValueAsString(order));

        assertThat(json.has("packageRef")).isFalse();                 // remapped, never leaks the field name
        assertThat(json.get("package").get("manager").asText()).isEqualTo("WINGET");
        assertThat(json.get("package").get("id").asText()).isEqualTo("Google.Chrome");
        assertThat(json.get("package").has("kind")).isFalse();        // winget: no brew fields
        assertThat(json.get("package").has("name")).isFalse();
        assertThat(json.get("mode").asText()).isEqualTo("FORCE");
        assertThat(json.get("countdownSeconds").asInt()).isEqualTo(300);
        assertThat(json.get("delivery").get("type").asText()).isEqualTo("PACKAGE_UPDATE");
        assertThat(json.get("delivery").get("targetId").asText()).isEqualTo("req-1");
        assertThat(json.get("delivery").get("sequence").asInt()).isEqualTo(43);
        assertThat(json.get("source").get("kind").asText()).isEqualTo("MANUAL");
        assertThat(json.get("source").get("origin").asText()).isEqualTo("ADMIN");
    }

    @Test
    void order_waitOmitsCountdown_and_brewOmitsId() {
        PackageUpdateMessage order = new PackageUpdateMessage();
        order.setRequestId("req-2");
        order.setSource(UpdateSource.builder().kind(UpdateSource.Kind.AUTO).build());
        order.setPackageRef(PackageReference.builder()
                .manager(PackageManagerType.BREW).kind(BrewPackageType.CASK).name("postman").build());
        order.setMode(PackageUpdateMode.WAIT);

        JsonNode json = mapper.readTree(mapper.writeValueAsString(order));

        assertThat(json.has("countdownSeconds")).isFalse();           // WAIT carries no countdown
        assertThat(json.get("source").has("origin")).isFalse();       // AUTO carries no origin
        assertThat(json.get("package").get("manager").asText()).isEqualTo("BREW");
        assertThat(json.get("package").get("kind").asText()).isEqualTo("CASK");
        assertThat(json.get("package").get("name").asText()).isEqualTo("postman");
        assertThat(json.get("package").has("id")).isFalse();          // brew: no winget id
    }

    @Test
    void status_waitingEvent_parsesFromContractJson() {
        String json = """
                {
                  "eventId": "evt-1",
                  "requestId": "req-1",
                  "machineId": "m-1",
                  "at": "2026-10-20T14:03:05Z",
                  "source": {"kind": "MANUAL", "origin": "USER"},
                  "package": {"manager": "WINGET", "id": "Google.Chrome"},
                  "installedVersion": "130.0.6723.70",
                  "availableVersion": "131.0.6778.86",
                  "state": "WAITING",
                  "waiting": {"reason": "APP_RUNNING", "phase": "COUNTDOWN",
                              "holders": [{"app": "chrome.exe", "user": "jane"}],
                              "closesAt": "2026-10-20T14:08:05Z"}
                }""";

        PackageUpdateStatusMessage msg = mapper.readValue(json, PackageUpdateStatusMessage.class);

        assertThat(msg.getEventId()).isEqualTo("evt-1");
        assertThat(msg.getAt()).isEqualTo(Instant.parse("2026-10-20T14:03:05Z"));
        assertThat(msg.getState()).isEqualTo(PackageUpdateStatusMessage.State.WAITING);
        assertThat(msg.getPackageRef().getManager()).isEqualTo(PackageManagerType.WINGET);
        assertThat(msg.getSource().getOrigin()).isEqualTo(UpdateSource.Origin.USER);
        assertThat(msg.getWaiting().getReason()).isEqualTo(PackageUpdateStatusMessage.Waiting.Reason.APP_RUNNING);
        assertThat(msg.getWaiting().getPhase()).isEqualTo(PackageUpdateStatusMessage.Waiting.Phase.COUNTDOWN);
        assertThat(msg.getWaiting().getClosesAt()).isEqualTo(Instant.parse("2026-10-20T14:08:05Z"));
        assertThat(msg.getWaiting().getHolders()).singleElement()
                .satisfies(h -> {
                    assertThat(h.getApp()).isEqualTo("chrome.exe");
                    assertThat(h.getUser()).isEqualTo("jane");
                });
        assertThat(msg.getDone()).isNull();
        assertThat(msg.getFailed()).isNull();
    }

    @Test
    void status_doneAndFailed_parse() {
        PackageUpdateStatusMessage done = mapper.readValue("""
                {"state":"DONE","done":{"result":"UPGRADED","rebootRequired":true,"relaunched":true}}""",
                PackageUpdateStatusMessage.class);
        assertThat(done.getDone().getResult()).isEqualTo(PackageUpdateStatusMessage.Done.Result.UPGRADED);
        assertThat(done.getDone().getRebootRequired()).isTrue();

        PackageUpdateStatusMessage failed = mapper.readValue("""
                {"state":"FAILED","failed":{"reason":"SUPERSEDED","exitCode":1,"message":"replaced"}}""",
                PackageUpdateStatusMessage.class);
        assertThat(failed.getFailed().getReason()).isEqualTo(PackageUpdateStatusMessage.Failed.Reason.SUPERSEDED);
        assertThat(failed.getFailed().getExitCode()).isEqualTo(1L);
    }

    @Test
    void status_failed_wingetHresultExitCode_parsesWithoutOverflow() {
        PackageUpdateStatusMessage msg = mapper.readValue("""
                {"state":"FAILED","failed":{"reason":"MANAGER_ERROR","exitCode":2316632081}}""",
                PackageUpdateStatusMessage.class);

        assertThat(msg.getState()).isEqualTo(PackageUpdateStatusMessage.State.FAILED);
        assertThat(msg.getFailed().getExitCode()).isEqualTo(2316632081L);
    }

    @Test
    void status_unknownEnumValues_readAsNull_notPoison() {
        PackageUpdateStatusMessage msg = mapper.readValue("""
                {"state":"PAUSED","waiting":{"reason":"DISK_FULL","phase":"PROMPT"}}""",
                PackageUpdateStatusMessage.class);

        assertThat(msg.getState()).isNull();                          // unknown top-level state tolerated
        assertThat(msg.getWaiting().getReason()).isNull();            // unknown reason tolerated
        assertThat(msg.getWaiting().getPhase()).isEqualTo(PackageUpdateStatusMessage.Waiting.Phase.PROMPT);
    }
}
