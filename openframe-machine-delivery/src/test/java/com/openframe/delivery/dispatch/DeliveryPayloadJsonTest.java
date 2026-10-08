package com.openframe.delivery.dispatch;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.TestPayload;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DeliveryPayloadJsonTest {

    private final DeliveryPayloadJson payloadJson = new DeliveryPayloadJson(new ObjectMapper());

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
    void read_corruptJson_illegalState() {
        // execution + verifications
        assertThatThrownBy(() -> payloadJson.read("{not json", TestPayload.class))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TestPayload");
    }
}
