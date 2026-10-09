package com.openframe.test.data.dto.ai;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MessageDataContractTest {

    @Test
    void read_attachmentsRecord_doesNotBreakConversationDeserialization() throws Exception {
        MessageData data = new JsonMapper().readValue("""
                {"type":"ATTACHMENTS","sources":[{"id":"doc-1"}],"videos":[],"cards":[]}
                """, MessageData.class);

        assertThat(data.getType()).isEqualTo(MessageDataType.ATTACHMENTS);
    }
}
