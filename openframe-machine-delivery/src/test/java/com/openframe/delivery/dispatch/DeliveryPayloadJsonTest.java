package com.openframe.delivery.dispatch;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.TestPayload;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DeliveryPayloadJsonTest {

    private final DeliveryPayloadJson payloadJson = new DeliveryPayloadJson(new JsonMapper());

    @Test
    void writeThenRead_payload_sameFieldsAndDeliveryBlock() {
        // setup
        TestPayload payload = new TestPayload();
        payload.setValue("issued");
        payload.setDelivery(new DeliveryRef(DeliveryType.CLIENT_UNINSTALL, "openframe-client", "d-1"));

        // execution
        String json = payloadJson.write(payload);
        TestPayload read = payloadJson.read(json, TestPayload.class);

        // verifications
        assertThat(read).isEqualTo(payload);
    }

    @Test
    void body_deliveryBlockLeftOut_rowsOfOneContentShareOneHash() {
        // setup
        TestPayload first = new TestPayload();
        first.setValue("issued");
        first.setDelivery(new DeliveryRef(DeliveryType.CLIENT_UNINSTALL, "openframe-client", "d-1"));
        TestPayload second = new TestPayload();
        second.setValue("issued");
        second.setDelivery(new DeliveryRef(DeliveryType.CLIENT_UNINSTALL, "openframe-client", "d-2"));
        TestPayload other = new TestPayload();
        other.setValue("different");

        // execution
        DeliveryPayloadBody firstBody = payloadJson.body(first);
        DeliveryPayloadBody secondBody = payloadJson.body(second);
        DeliveryPayloadBody otherBody = payloadJson.body(other);

        // verifications
        assertThat(firstBody.json()).isEqualTo("{\"value\":\"issued\"}");
        assertThat(firstBody).isEqualTo(secondBody);
        assertThat(firstBody.hash()).hasSize(64).isNotEqualTo(otherBody.hash());
        assertThat(payloadJson.read(firstBody.json(), TestPayload.class).getDelivery()).isNull();
    }

    @Test
    void read_corruptJson_illegalState() {
        // execution + verifications
        assertThatThrownBy(() -> payloadJson.read("{not json", TestPayload.class))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TestPayload");
    }
}
