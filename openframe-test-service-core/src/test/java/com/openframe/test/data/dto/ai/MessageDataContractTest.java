package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MessageDataContractTest {

    @Test
    void read_attachmentsRecord_doesNotBreakConversationDeserialization() throws Exception {
        MessageData data = new ObjectMapper().readValue("""
                {"type":"ATTACHMENTS","sources":[{"id":"doc-1"}],"videos":[],"cards":[]}
                """, MessageData.class);

        assertThat(data.getType()).isEqualTo(MessageDataType.ATTACHMENTS);
    }
}
